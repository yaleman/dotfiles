#!/usr/bin/swift
import Darwin
import Foundation
import OSLog
import Security

private let service = "org.yaleman.keychain-secret"
private let labelPrefix = "keychain-secret:"
private let oldLabelPrefix = "direnv secret: "

private let logger = Logger(
    subsystem: "com.yaleman.keychain-secret",
    category: "debugging"
)

private func die(_ message: String, status: Int32 = 1) -> Never {
    logger.error("\(message, privacy: .public)")
    FileHandle.standardError.write(Data(("keychain-secret: \(message)\n").utf8))
    exit(status)
}

private func securityError(_ status: OSStatus) -> String {
    if let message = SecCopyErrorMessageString(status, nil) as String? {
        return "\(message) (\(status))"
    }
    return "OSStatus \(status)"
}

private func query(for name: String) -> [String: Any] {
    [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: name,
    ]
}

private func migrateSecret() {
    let search: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecReturnAttributes as String: true,
        kSecMatchLimit as String: kSecMatchLimitAll,
    ]

    var result: CFTypeRef?
    let status = SecItemCopyMatching(search as CFDictionary, &result)

    switch status {
    case errSecSuccess:
        break
    case errSecItemNotFound:
        return
    default:
        die("could not search for old secrets: \(securityError(status))")
    }

    guard let items = result as? [[String: Any]] else {
        die("Keychain returned unexpected search results")
    }

    for item in items {
        guard
            let oldLabel = item[kSecAttrLabel as String] as? String,
            oldLabel.hasPrefix(oldLabelPrefix),
            let account = item[kSecAttrAccount as String] as? String
        else {
            continue
        }

        let migrationSearch: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrLabel as String: oldLabel,
        ]
        let update = [
            kSecAttrLabel as String: "\(labelPrefix)\(oldLabel.dropFirst(oldLabelPrefix.count))"
        ]
        let updateStatus = SecItemUpdate(
            migrationSearch as CFDictionary,
            update as CFDictionary
        )

        guard updateStatus == errSecSuccess else {
            die("could not migrate \(oldLabel): \(securityError(updateStatus))")
        }
    }
}

private func readSecret() -> Data {
    // If stdin isn't a terminal, consume it exactly as supplied.
    if isatty(STDIN_FILENO) == 0 {
        return FileHandle.standardInput.readDataToEndOfFile()
    }

    // Interactive input: disable terminal echo rather than using getpass(),
    // which has historically had annoyingly small password length limits.
    var original = termios()

    guard tcgetattr(STDIN_FILENO, &original) == 0 else {
        die("tcgetattr failed: \(String(cString: strerror(errno)))")
    }

    var hidden = original
    hidden.c_lflag &= ~tcflag_t(ECHO)

    FileHandle.standardError.write(Data("Secret: ".utf8))

    guard tcsetattr(STDIN_FILENO, TCSAFLUSH, &hidden) == 0 else {
        die("tcsetattr failed: \(String(cString: strerror(errno)))")
    }

    defer {
        _ = tcsetattr(STDIN_FILENO, TCSAFLUSH, &original)
        FileHandle.standardError.write(Data("\n".utf8))
    }

    guard let value = readLine(strippingNewline: true) else {
        die("failed to read secret")
    }

    return Data(value.utf8)
}

private func setSecret(name: String) {
    let data = readSecret()

    var search = query(for: name)

    let update: [String: Any] = [
        kSecValueData as String: data,
        kSecAttrLabel as String: "\(labelPrefix)\(name)",
    ]

    let updateStatus = SecItemUpdate(
        search as CFDictionary,
        update as CFDictionary
    )

    switch updateStatus {
    case errSecSuccess:
        return

    case errSecItemNotFound:
        search[kSecValueData as String] = data
        search[kSecAttrLabel as String] = "\(labelPrefix)\(name)"

        let addStatus = SecItemAdd(
            search as CFDictionary,
            nil
        )

        guard addStatus == errSecSuccess else {
            die("could not add \(name): \(securityError(addStatus))")
        }

    default:
        die("could not update \(name): \(securityError(updateStatus))")
    }
}

private func getSecret(name: String) {
    var search = query(for: name)

    search[kSecReturnData as String] = true
    search[kSecMatchLimit as String] = kSecMatchLimitOne

    var result: CFTypeRef?

    let status = SecItemCopyMatching(
        search as CFDictionary,
        &result
    )

    switch status {
    case errSecSuccess:
        break

    case errSecItemNotFound:
        die("secret not found: \(name)", status: 2)

    default:
        die("could not retrieve \(name): \(securityError(status))")
    }

    guard let data = result as? Data else {
        die("Keychain returned something that wasn't Data")
    }

    FileHandle.standardOutput.write(data)
}

private func deleteSecret(name: String) {
    let status = SecItemDelete(
        query(for: name) as CFDictionary
    )

    switch status {
    case errSecSuccess:
        return

    case errSecItemNotFound:
        die("secret not found: \(name)", status: 2)

    default:
        die("could not delete \(name): \(securityError(status))")
    }
}

private func usage() -> Never {
    let program = URL(fileURLWithPath: CommandLine.arguments[0]).lastPathComponent

    FileHandle.standardError.write(
        Data(
            """
            Usage:
              \(program) set NAME
              \(program) get NAME
              \(program) delete NAME
              \(program) migrate

            set reads the secret from stdin.

            If stdin is a terminal, input is hidden:

              \(program) set GITHUB_TOKEN

            Piped input is stored exactly as supplied:

              printf '%s' "$TOKEN" | \(program) set GITHUB_TOKEN
              pbpaste | \(program) set GITHUB_TOKEN

            get writes only the raw secret to stdout:

              export GITHUB_TOKEN="$(\(program) get GITHUB_TOKEN)"

            """.utf8))

    exit(64)
}

guard CommandLine.arguments.count >= 2 else {
    usage()
}

let command = CommandLine.arguments[1]

switch command {
case "set":
    guard CommandLine.arguments.count == 3 else { usage() }
    let name = CommandLine.arguments[2]
    guard !name.isEmpty else { die("secret name cannot be empty") }
    setSecret(name: name)

case "get":
    guard CommandLine.arguments.count == 3 else { usage() }
    let name = CommandLine.arguments[2]
    guard !name.isEmpty else { die("secret name cannot be empty") }
    getSecret(name: name)

case "delete", "rm":
    guard CommandLine.arguments.count == 3 else { usage() }
    let name = CommandLine.arguments[2]
    guard !name.isEmpty else { die("secret name cannot be empty") }
    deleteSecret(name: name)
case "migrate":
    guard CommandLine.arguments.count == 2 else { usage() }
    migrateSecret()
default:
    usage()
}
