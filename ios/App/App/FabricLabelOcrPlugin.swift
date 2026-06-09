import Foundation
import Capacitor
import Vision
import UIKit

@objc(FabricLabelOcrPlugin)
public class FabricLabelOcrPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FabricLabelOcrPlugin"
    public let jsName = "FabricLabelOcr"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "recognizeLabel", returnType: CAPPluginReturnPromise)
    ]

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": true])
    }

    @objc func recognizeLabel(_ call: CAPPluginCall) {
        guard let base64 = call.getString("base64"), !base64.isEmpty else {
            call.reject("missing_base64")
            return
        }

        let payload = base64.contains(",") ? String(base64.split(separator: ",").last ?? "") : base64
        guard let data = Data(base64Encoded: payload, options: .ignoreUnknownCharacters),
              let image = UIImage(data: data),
              let cgImage = image.cgImage else {
            call.reject("invalid_image")
            return
        }

        let request = VNRecognizeTextRequest { request, error in
            if let error = error {
                call.reject("vision_error", error.localizedDescription, error)
                return
            }

            let observations = request.results as? [VNRecognizedTextObservation] ?? []
            let lines = observations.compactMap { obs in
                obs.topCandidates(1).first?.string.trimmingCharacters(in: .whitespacesAndNewlines)
            }.filter { !$0.isEmpty }

            let rawText = lines.joined(separator: "\n")
            let fields = Self.parseLabelLines(lines)

            call.resolve([
                "job": fields.job,
                "fabric": fields.fabric,
                "size": fields.size,
                "rawText": rawText
            ])
        }

        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        request.recognitionLanguages = ["en-US"]

        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try handler.perform([request])
            } catch {
                call.reject("vision_failed", error.localizedDescription, error)
            }
        }
    }

    private static func parseLabelLines(_ lines: [String]) -> (job: String, fabric: String, size: String) {
        var job = ""
        var fabric = ""
        var size = ""

        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty { continue }

            let digits = trimmed.replacingOccurrences(of: "[^0-9]", with: "", options: .regularExpression)
            if digits.count >= 5 && digits.count <= 8 && job.isEmpty {
                job = digits
                continue
            }

            if trimmed.range(of: "\\d+\\s*['′]?\\s*[xX×]\\s*\\d+", options: .regularExpression) != nil {
                size = trimmed
                continue
            }

            if trimmed.range(of: "[A-Za-z]{3,}", options: .regularExpression) != nil && fabric.isEmpty {
                fabric = trimmed.uppercased()
            }
        }

        if job.isEmpty, let first = lines.first {
            let digits = first.replacingOccurrences(of: "[^0-9]", with: "", options: .regularExpression)
            if digits.count >= 4 { job = digits }
        }
        if fabric.isEmpty, lines.count >= 2 {
            fabric = lines[1].uppercased()
        }
        if size.isEmpty, lines.count >= 3 {
            size = lines[2]
        }

        return (job, fabric, size)
    }
}
