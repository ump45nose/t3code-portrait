import AppKit
import Foundation

// Watches macOS application launches for T3 Code. When T3 Code is opened normally
// (without the local debugging port), cleanly relaunches it with --remote-debugging-port
// and starts injector.mjs so portrait mode works from the regular Dock / Spotlight icon.

let env = ProcessInfo.processInfo.environment
let t3App = env["T3P_APP"] ?? "/Applications/T3 Code (Nightly).app"
let targetBundleId = env["T3P_BUNDLE_ID"] ?? ""
let nodePath = env["T3P_NODE"] ?? "/opt/homebrew/bin/node"
let injectorPath = env["T3P_INJECTOR"] ?? ""
let port = env["T3P_PORT"] ?? "9338"
let logDir = (NSHomeDirectory() as NSString).appendingPathComponent("Library/Logs/t3code-portrait")
let injectorLog = (logDir as NSString).appendingPathComponent("injector.log")

func log(_ msg: String) {
    let ts = ISO8601DateFormatter().string(from: Date())
    fputs("\(ts) [watcher] \(msg)\n", stderr)
    fflush(stderr)
}

func runCapture(_ path: String, _ args: [String]) -> (Int32, String) {
    let proc = Process()
    proc.executableURL = URL(fileURLWithPath: path)
    proc.arguments = args
    let pipe = Pipe()
    proc.standardOutput = pipe
    proc.standardError = FileHandle.nullDevice
    do {
        try proc.run()
        proc.waitUntilExit()
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        return (proc.terminationStatus, String(data: data, encoding: .utf8) ?? "")
    } catch {
        return (-1, "")
    }
}

func hasDebugPortArg(pid: pid_t) -> Bool {
    let (_, out) = runCapture("/bin/ps", ["-p", String(pid), "-o", "args="])
    return out.contains("--remote-debugging-port=\(port)") || out.contains("--remote-debugging-port \(port)")
}

func isInjectorRunning() -> Bool {
    let (status, _) = runCapture("/usr/bin/pgrep", ["-fq", "--", "injector.mjs --port \(port)"])
    return status == 0
}

func startInjector() {
    guard !injectorPath.isEmpty else { return }
    if isInjectorRunning() { return }
    try? FileManager.default.createDirectory(atPath: logDir, withIntermediateDirectories: true)
    let proc = Process()
    proc.executableURL = URL(fileURLWithPath: nodePath)
    proc.arguments = [injectorPath, "--port", port]
    if !FileManager.default.fileExists(atPath: injectorLog) {
        FileManager.default.createFile(atPath: injectorLog, contents: nil)
    }
    if let fh = FileHandle(forWritingAtPath: injectorLog) {
        fh.seekToEndOfFile()
        proc.standardOutput = fh
        proc.standardError = fh
    }
    do {
        try proc.run()
        log("started injector (pid \(proc.processIdentifier))")
    } catch {
        log("failed to start injector: \(error)")
    }
}

func stopStandaloneT3Serve() {
    let pattern = "\(NSHomeDirectory())/.t3/runtime/versions/.*/t3 serve"
    let (_, out) = runCapture("/usr/bin/pgrep", ["-f", "--", pattern])
    let pids = out.split(whereSeparator: \.isWhitespace).compactMap { Int32($0) }
    guard !pids.isEmpty else { return }
    for pid in pids { kill(pid, SIGTERM) }
    for _ in 0..<20 {
        let (st, _) = runCapture("/usr/bin/pgrep", ["-fq", "--", pattern])
        if st != 0 { return }
        Thread.sleep(forTimeInterval: 0.1)
    }
    for pid in pids { kill(pid, SIGKILL) }
}

func relaunchWithDebugPort(_ app: NSRunningApplication) {
    let pid = app.processIdentifier
    log("T3 Code launched without port \(port) (pid \(pid)); relaunching with debugging port")
    app.terminate()
    for _ in 0..<40 {
        if app.isTerminated { break }
        Thread.sleep(forTimeInterval: 0.1)
    }
    if !app.isTerminated {
        app.forceTerminate()
        for _ in 0..<20 {
            if app.isTerminated { break }
            Thread.sleep(forTimeInterval: 0.1)
        }
    }
    stopStandaloneT3Serve()
    let (st, _) = runCapture("/usr/bin/open", ["-a", t3App, "--args", "--remote-debugging-port=\(port)"])
    if st != 0 {
        log("open -a failed with status \(st)")
        return
    }
    startInjector()
}

final class Watcher: NSObject {
    private let queue = DispatchQueue(label: "t3code-portrait.watcher")
    private var lastRelaunchAt = Date.distantPast

    func start() {
        guard !targetBundleId.isEmpty else {
            log("T3P_BUNDLE_ID is required")
            exit(2)
        }
        // If T3 is already running with the port when watcher starts, just attach injector.
        for app in NSWorkspace.shared.runningApplications where app.bundleIdentifier == targetBundleId {
            if hasDebugPortArg(pid: app.processIdentifier) {
                log("detected running T3 Code with port \(port); ensuring injector")
                startInjector()
            }
        }
        NSWorkspace.shared.notificationCenter.addObserver(
            self,
            selector: #selector(handleLaunch(_:)),
            name: NSWorkspace.didLaunchApplicationNotification,
            object: nil
        )
        log("watching launches for \(targetBundleId) -> \(t3App) (port \(port))")
    }

    @objc private func handleLaunch(_ note: Notification) {
        guard let app = note.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication,
              app.bundleIdentifier == targetBundleId else {
            return
        }
        queue.async { [weak self] in
            guard let self else { return }
            if hasDebugPortArg(pid: app.processIdentifier) {
                log("T3 Code launched with port \(port) (pid \(app.processIdentifier)); ensuring injector")
                startInjector()
                return
            }
            if Date().timeIntervalSince(self.lastRelaunchAt) < 6.0 {
                log("skipping relaunch within cooldown window")
                return
            }
            self.lastRelaunchAt = Date()
            relaunchWithDebugPort(app)
        }
    }
}

let watcher = Watcher()
watcher.start()
RunLoop.main.run()
