// Activates the browser tools client in Blazor apps that render on the server (static SSR or
// Interactive Server), which the browser refresh TagHelper does not reach.
//
// The provider reports its availability over a stable application route. The configuration module
// is app hosted, so resolving it relative to import.meta.url keeps it correct under any static web
// asset base path or fingerprinting scheme.

// Substituted by Microsoft.NET.Sdk.StaticWebAssets.HotReload.targets.
const settingsPath = '/_framework/dotnet-browser-tools/hot-reload-settings.json';
const configModulePath = './Microsoft.NET.Sdk.BlazorWeb.HotReload.BrowserTools.Config.js';
const settingsRequestTimeoutMilliseconds = 5000;

export async function afterWebStarted() {
    if (!await isHotReloadEnabled()) {
        return;
    }

    // The browser tools client de-duplicates activation, so importing the configuration module is safe
    // even when another initializer or the browser refresh TagHelper already imported it.
    await import(new URL(configModulePath, import.meta.url).href);
}

async function isHotReloadEnabled() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), settingsRequestTimeoutMilliseconds);

    try {
        const response = await fetch(settingsPath, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) {
            return false;
        }

        const settings = await response.json();
        return settings?.hotReload === true;
    } catch (error) {
        console.debug('Unable to read the Hot Reload browser tools settings.', error);
        return false;
    } finally {
        clearTimeout(timeout);
    }
}

// SIG // Begin signature block
// SIG // MIInWwYJKoZIhvcNAQcCoIInTDCCJ0gCAQExDzANBglg
// SIG // hkgBZQMEAgEFADB3BgorBgEEAYI3AgEEoGkwZzAyBgor
// SIG // BgEEAYI3AgEeMCQCAQEEEBDgyQbOONQRoqMAEEvTUJAC
// SIG // AQACAQACAQACAQACAQAwMTANBglghkgBZQMEAgEFAAQg
// SIG // cO/7WF9Mj8uf3H+sa6sv+8vmugvEI4WxOtJsqXU2tWWg
// SIG // ggy4MIIF8zCCA9ugAwIBAgITMwAAAceaoe7cJ+L4twAA
// SIG // AAABxzANBgkqhkiG9w0BAQsFADBXMQswCQYDVQQGEwJV
// SIG // UzEeMBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9u
// SIG // MSgwJgYDVQQDEx9NaWNyb3NvZnQgQ29kZSBTaWduaW5n
// SIG // IFBDQSAyMDI0MB4XDTI2MDQxNjE4NTczOVoXDTI3MDQx
// SIG // NTE4NTczOVowYzELMAkGA1UEBhMCVVMxEzARBgNVBAgT
// SIG // Cldhc2hpbmd0b24xEDAOBgNVBAcTB1JlZG1vbmQxHjAc
// SIG // BgNVBAoTFU1pY3Jvc29mdCBDb3Jwb3JhdGlvbjENMAsG
// SIG // A1UEAxMELk5FVDCCASIwDQYJKoZIhvcNAQEBBQADggEP
// SIG // ADCCAQoCggEBAMB61gBm+zIpG+zndRVKQsKhMDkm93i+
// SIG // sXwp1OHJ+EGnqv1EntlMxQ3XglhWpxS83yMw+VBm/IAT
// SIG // tMIr2/2LITEnBBgY8+EA+SCxn1G0cBlR0WhlEvQs49DG
// SIG // k4iUoAbAyEDjThvokHS6apuvqwViuP+cFci9SS4x6a45
// SIG // h+ujrl5qy77RkgYpBhapvgPLM1zvtPsCzh1t7j2K/05r
// SIG // 4JJAJqWIPZ+PjSvXJLKW95EH3vxPhtfdhm6sEK4xpcKM
// SIG // CG7qsL/dCqhGeHk+IQgxTecwZyWbMyY305PiUnGcc728
// SIG // 8wHNr36J3Z8c5BWFWptyocQafTXjiMil7OS8KYmhgHYg
// SIG // 6xkCAwEAAaOCAaowggGmMA4GA1UdDwEB/wQEAwIHgDAf
// SIG // BgNVHSUEGDAWBgorBgEEAYI3TAgBBggrBgEFBQcDAzAd
// SIG // BgNVHQ4EFgQUgAm0ef/T6uytGybTjdg8DFX/L58wVAYD
// SIG // VR0RBE0wS6RJMEcxLTArBgNVBAsTJE1pY3Jvc29mdCBJ
// SIG // cmVsYW5kIE9wZXJhdGlvbnMgTGltaXRlZDEWMBQGA1UE
// SIG // BRMNNDY0MjIzKzUwNzYwNjAfBgNVHSMEGDAWgBR/WT9U
// SIG // IdqtT+8F5eaj1y0GlBIIMTBgBgNVHR8EWTBXMFWgU6BR
// SIG // hk9odHRwOi8vd3d3Lm1pY3Jvc29mdC5jb20vcGtpb3Bz
// SIG // L2NybC9NaWNyb3NvZnQlMjBDb2RlJTIwU2lnbmluZyUy
// SIG // MFBDQSUyMDIwMjQuY3JsMG0GCCsGAQUFBwEBBGEwXzBd
// SIG // BggrBgEFBQcwAoZRaHR0cDovL3d3dy5taWNyb3NvZnQu
// SIG // Y29tL3BraW9wcy9jZXJ0cy9NaWNyb3NvZnQlMjBDb2Rl
// SIG // JTIwU2lnbmluZyUyMFBDQSUyMDIwMjQuY3J0MAwGA1Ud
// SIG // EwEB/wQCMAAwDQYJKoZIhvcNAQELBQADggIBAImzEt/g
// SIG // Gt+QAA3NGlRZUv+koTULWxSFT/osH1YxbVKFgSYU9dA9
// SIG // BpFDzo1lF+IhVTgjjwHXhaA87P4YTztl3RQfrlrrED7F
// SIG // 008DHiJ+G/7nnTxkb7y9fNRTTw9Ac/hGTWkQBW5Vaujm
// SIG // gWQflToTpMKNlqVbGFg+UVZKxi+k5MhsULjKt5K/ulH5
// SIG // bVuvnXrZmeF3XRGuSsQe2YjpNYaYHq713itwdNwyYq7p
// SIG // rpQ4R3xiUBw6SOOaH2UyDdhyQisZl8V3wFNhY2t6yZkQ
// SIG // CyGG+GZF49Q8vc1l+Tl+pcRa8l+4u3Rq18QUDJenW4Up
// SIG // 5y/a+mLTyxM8pYRQpPDqVX5U9NTfLbgZWKxQmkN+0mpJ
// SIG // 4CRpAniIiJJC4ag7Wjky+Asgik8xb/16wqiw72xDdPCk
// SIG // 7TN0g/G4PlmyyDP+hdSjzlq5JiQK2ubfEhAqoRD1tmKK
// SIG // 4R3QqIFlLZsPjE87AXlZ4PJHzutH2YnNsUQ45oDDCf3j
// SIG // 6vfslGL01M3XAgkDXhskyOXxb1v7of0JR8GzCvsIkNeM
// SIG // QmeXc5FZwi7xXG6UeNh1Z4SA3qJo+H+ItV/dMgjxCWPl
// SIG // Yfzgh6a2CXXaEruZvnLpwD+cCuZxYhGYIJfrsWoCh4Gf
// SIG // AtkvG3Z0fHgeftB90byXroQbupqohCUppbug9df+2PjO
// SIG // aPWk0oPvu/4HzFaZMIIGvTCCBKWgAwIBAgITMwAAADk7
// SIG // tjcZvwYdZwAAAAAAOTANBgkqhkiG9w0BAQwFADCBiDEL
// SIG // MAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24x
// SIG // EDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jv
// SIG // c29mdCBDb3Jwb3JhdGlvbjEyMDAGA1UEAxMpTWljcm9z
// SIG // b2Z0IFJvb3QgQ2VydGlmaWNhdGUgQXV0aG9yaXR5IDIw
// SIG // MTEwHhcNMjQwODA4MjA1NDE4WhcNMzYwMzIyMjIxMzA0
// SIG // WjBXMQswCQYDVQQGEwJVUzEeMBwGA1UEChMVTWljcm9z
// SIG // b2Z0IENvcnBvcmF0aW9uMSgwJgYDVQQDEx9NaWNyb3Nv
// SIG // ZnQgQ29kZSBTaWduaW5nIFBDQSAyMDI0MIICIjANBgkq
// SIG // hkiG9w0BAQEFAAOCAg8AMIICCgKCAgEA2AGcHuM4x6qV
// SIG // Fgc1rbrm/ghj18fxMqF6Yd88g17WCktpXd2GDfbhbAfT
// SIG // otwdumewG6QIM2K2vKjR21L8Rboj/IQv9stJjyEqlt9C
// SIG // 5a6wE+v2prNhwPEJb+qeNvkmwjWzxs06DdtUBO9BUvi1
// SIG // x/TdpPJyzPxB4J0zSX/IdE5sn1CprMzWvpU8Q4nssv64
// SIG // QRvvfDpAK6Gzz1rW6/XN6s5gyeyd5FHAJunJbXUhyCBT
// SIG // RxEoMOrWmNUnMhsgXr6iJddtF46yB4jzO7UXJB8rR9WR
// SIG // rJrxKZUdD+05/beZnhb2TRGLbZBb2ndSBILk5QOS0rHF
// SIG // wKYYvq1ct84ZJYcghXhitMlNPo823LlESiMcm5kcCuQX
// SIG // 1WcdMRFahOMDN8jeQ/7lvhqVR2GABnu2067VtWdd8dqo
// SIG // 9iXas+zbSOLTcs5VayH+tp2ATXt6zmEv63qVXR5UetWG
// SIG // yyxE5Ym7PYxcwK3uLDuUU8b0tcoaOyaiefaCi0Z0ci4S
// SIG // DkmckwlWaLF3ktGWSaBhFkrOHFILDKgYirQ+FoDtj5U9
// SIG // y3mkIeSKNwggObSeWQr7QrJ6miVyoabRP8ZhBEyEcmUY
// SIG // 46ZVCinfrBRVRiSVTL768NZ4SASjizuHE3qYht/YxIhD
// SIG // +Ih8xmAnELr2i6QxRcKs4LdKQT/EiSCl+XbYwzWK2Rnf
// SIG // mc1eQyiVTWUCAwEAAaOCAU4wggFKMA4GA1UdDwEB/wQE
// SIG // AwIBhjAQBgkrBgEEAYI3FQEEAwIBADAdBgNVHQ4EFgQU
// SIG // f1k/VCHarU/vBeXmo9ctBpQSCDEwGQYJKwYBBAGCNxQC
// SIG // BAweCgBTAHUAYgBDAEEwDwYDVR0TAQH/BAUwAwEB/zAf
// SIG // BgNVHSMEGDAWgBRyLToCMZBDuRQFTuHqp8cx0SOJNDBa
// SIG // BgNVHR8EUzBRME+gTaBLhklodHRwOi8vY3JsLm1pY3Jv
// SIG // c29mdC5jb20vcGtpL2NybC9wcm9kdWN0cy9NaWNSb29D
// SIG // ZXJBdXQyMDExXzIwMTFfMDNfMjIuY3JsMF4GCCsGAQUF
// SIG // BwEBBFIwUDBOBggrBgEFBQcwAoZCaHR0cDovL3d3dy5t
// SIG // aWNyb3NvZnQuY29tL3BraS9jZXJ0cy9NaWNSb29DZXJB
// SIG // dXQyMDExXzIwMTFfMDNfMjIuY3J0MA0GCSqGSIb3DQEB
// SIG // DAUAA4ICAQAUlB84KE/uiefp8sgwqtKU3VZgrAMWAB13
// SIG // KY5Q7cWszx3sH9b+JDoPFewOfsPlbjAzBh4vKy1wSp+S
// SIG // PPg1RFGBrPIy7nJHNCHguqMDi1K1NwmHWikTGjuefk+4
// SIG // 8Fidu7T5MdK5UdN7RVNM9WGKXL+mIWsOjdrFD0/gL46X
// SIG // nJ637aBN96QgJLnFL5xh9Ii+CfQmSxUFUxhUjlAW7+qG
// SIG // cuGwQURTMbx++/SGOCQ76WSlX23LoaQ3i92d3vJrpDpp
// SIG // H3LfhqIzWqbFrEGLo5SfI2Xp+S66f92JMWdgMtOmk6Sv
// SIG // +aDlZJ8KINUw0LG2PjA8oLk6YebUNAi38w2iRtsfdQaw
// SIG // U/VBvOwuhy5KosK8fT0ijd8M9OaxxH1jvkbipftFNfwB
// SIG // 0E+jQjo4SiN/f3O4Vm3So4ebrlhZATr1xkza54TUwHTl
// SIG // 002Acr2BMTvMq8r9+DwHaqNbzwxP9YXlXm69ka2pr0VI
// SIG // vZFrMCsD6sM+5/okZjPgemAxkcHhLqzNZIpgG/RWKwLN
// SIG // /GB5T52q5db1t3Rq5iU4HnwM9w5gp1zdJ73iD7EvilwS
// SIG // FsHngk6ACTBhO7/10t4fakOp4lkAAFUNZFAJpd87kuDI
// SIG // rAoIthemKCtlgKNRIFyv5V7w8VYyFVNCXS/irwn8BSZA
// SIG // 3lbifXTVxjYvgDsZNAbWHfYccC99ARJY/TGCGfswghn3
// SIG // AgEBMG4wVzELMAkGA1UEBhMCVVMxHjAcBgNVBAoTFU1p
// SIG // Y3Jvc29mdCBDb3Jwb3JhdGlvbjEoMCYGA1UEAxMfTWlj
// SIG // cm9zb2Z0IENvZGUgU2lnbmluZyBQQ0EgMjAyNAITMwAA
// SIG // Aceaoe7cJ+L4twAAAAABxzANBglghkgBZQMEAgEFAKCB
// SIG // rjAZBgkqhkiG9w0BCQMxDAYKKwYBBAGCNwIBBDAcBgor
// SIG // BgEEAYI3AgELMQ4wDAYKKwYBBAGCNwIBFTAvBgkqhkiG
// SIG // 9w0BCQQxIgQgqS7RtR/VSY/mrIP3qJLSsV91MA9/g87S
// SIG // gevDQ+gNnPIwQgYKKwYBBAGCNwIBDDE0MDKgFIASAE0A
// SIG // aQBjAHIAbwBzAG8AZgB0oRqAGGh0dHA6Ly93d3cubWlj
// SIG // cm9zb2Z0LmNvbTANBgkqhkiG9w0BAQEFAASCAQAMKdgz
// SIG // 870rnqsvmK/iLUN2mxFAznxw5MoHMmUK+2Jahni9aO6V
// SIG // YGsyHc6hTMS2Zlu6Rybq2qbSz/X51VoDDcTTtalcGoSL
// SIG // ACrOR00rNI/wxPTlv+3FNuaIm30vxgz7NicCuK1QpVoz
// SIG // BHBGmRJBHj8Lp9OuCrKoH/H9crSo3yCrkJclWBVYmTlv
// SIG // 5idgRKemLaqiLmX8XV4V40meMEPiLAgrCWiBar6qz0wW
// SIG // krVPlNz3cY2pksxncymJbWpJeoY1kY8Yg6CjfYIZgXkx
// SIG // GD/ZUvIXkfB0UEFQMJvSD0wRa+A3uTZOhSOHehIKBm3P
// SIG // gatEPqbc/W6zphxfjmivmvPSzFPCoYIXrTCCF6kGCisG
// SIG // AQQBgjcDAwExgheZMIIXlQYJKoZIhvcNAQcCoIIXhjCC
// SIG // F4ICAQMxDzANBglghkgBZQMEAgEFADCCAVoGCyqGSIb3
// SIG // DQEJEAEEoIIBSQSCAUUwggFBAgEBBgorBgEEAYRZCgMB
// SIG // MDEwDQYJYIZIAWUDBAIBBQAEIFNEkXK7/rFBUk8xpTnD
// SIG // P6PJYA7CmndXm34sd8OHs3nVAgZq3eenFL4YEzIwMjYx
// SIG // MDMwMDQzMzA4LjQ1OFowBIACAfSggdmkgdYwgdMxCzAJ
// SIG // BgNVBAYTAlVTMRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAw
// SIG // DgYDVQQHEwdSZWRtb25kMR4wHAYDVQQKExVNaWNyb3Nv
// SIG // ZnQgQ29ycG9yYXRpb24xLTArBgNVBAsTJE1pY3Jvc29m
// SIG // dCBJcmVsYW5kIE9wZXJhdGlvbnMgTGltaXRlZDEnMCUG
// SIG // A1UECxMeblNoaWVsZCBUU1MgRVNOOjU1MUEtMDVFMC1E
// SIG // OTQ3MSUwIwYDVQQDExxNaWNyb3NvZnQgVGltZS1TdGFt
// SIG // cCBTZXJ2aWNloIIR+zCCBygwggUQoAMCAQICEzMAAAIb
// SIG // 0LK4Amf3cs8AAQAAAhswDQYJKoZIhvcNAQELBQAwfDEL
// SIG // MAkGA1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24x
// SIG // EDAOBgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jv
// SIG // c29mdCBDb3Jwb3JhdGlvbjEmMCQGA1UEAxMdTWljcm9z
// SIG // b2Z0IFRpbWUtU3RhbXAgUENBIDIwMTAwHhcNMjUwODE0
// SIG // MTg0ODMwWhcNMjYxMTEzMTg0ODMwWjCB0zELMAkGA1UE
// SIG // BhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNV
// SIG // BAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBD
// SIG // b3Jwb3JhdGlvbjEtMCsGA1UECxMkTWljcm9zb2Z0IEly
// SIG // ZWxhbmQgT3BlcmF0aW9ucyBMaW1pdGVkMScwJQYDVQQL
// SIG // Ex5uU2hpZWxkIFRTUyBFU046NTUxQS0wNUUwLUQ5NDcx
// SIG // JTAjBgNVBAMTHE1pY3Jvc29mdCBUaW1lLVN0YW1wIFNl
// SIG // cnZpY2UwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIK
// SIG // AoICAQCOxZ3nZlmTMHld7mD+XYaw6MDPfSyDqNXF8UlX
// SIG // 7DjEgNXJojcs7xsimbNi6XcBkeDnRQhDw+tJFkalCoWR
// SIG // E276jdgoniDa4ZgFGSwecdhHS5VIJCDnxOGRjJ6mUZfe
// SIG // gC8ZFW48ilC0CJOxHvoD+B2hTscPARtvvdsnBPKtsoeF
// SIG // H5ZozL0NAcjiTlCjj5tkOzSSPvpu+Em90ZT5LzPFAGnt
// SIG // QCGMmcWorEi6xIhMTvMIJHjbYQuGSFVU4WorbDqHUwC8
// SIG // gt7vqHFEhw+PRIEvavw723HmeNTj62DasB1TXnembKGp
// SIG // rN2lRxxgET3ANEVR3970KhbHtN2dSJwH4xqLtFPqqx7t
// SIG // 7loapfUHtueP9ke+ut8X4EkQiVL2INcBSB6S9dn4VmaO
// SIG // 8vA/5037T9yuH76vh7wWScXsRfogl+eY14M3/rxnn2Rt
// SIG // onV/4/macph/J0J5mbGsalLS1paQOTfoPeM9Vl+W/Gtz
// SIG // 7WuEIiUzm/1qAsQUjXZCIFN+k4E4GvcAYI+T54fT6Vq2
// SIG // NBqO6D7b8EPXapvzbnTQtDK1RZPai1r8didGBK/WO9nT
// SIG // 92aXUWzFZjM6cKuN90H/s3qk3JK3i+f48Y3p0UuKbuTG
// SIG // iz4H1Z9A97MmLd+4rLIMAH3NIc+PVm7ydl95xkn26bjO
// SIG // PsMWC8ldMNOcbmqUbhl1sVFr+ut/OQIDAQABo4IBSTCC
// SIG // AUUwHQYDVR0OBBYEFLa+n3f+XEumk0rw6Rq4nYC82YhQ
// SIG // MB8GA1UdIwQYMBaAFJ+nFV0AXmJdg/Tl0mWnG1M1Gely
// SIG // MF8GA1UdHwRYMFYwVKBSoFCGTmh0dHA6Ly93d3cubWlj
// SIG // cm9zb2Z0LmNvbS9wa2lvcHMvY3JsL01pY3Jvc29mdCUy
// SIG // MFRpbWUtU3RhbXAlMjBQQ0ElMjAyMDEwKDEpLmNybDBs
// SIG // BggrBgEFBQcBAQRgMF4wXAYIKwYBBQUHMAKGUGh0dHA6
// SIG // Ly93d3cubWljcm9zb2Z0LmNvbS9wa2lvcHMvY2VydHMv
// SIG // TWljcm9zb2Z0JTIwVGltZS1TdGFtcCUyMFBDQSUyMDIw
// SIG // MTAoMSkuY3J0MAwGA1UdEwEB/wQCMAAwFgYDVR0lAQH/
// SIG // BAwwCgYIKwYBBQUHAwgwDgYDVR0PAQH/BAQDAgeAMA0G
// SIG // CSqGSIb3DQEBCwUAA4ICAQBmRTVfFAPg5MzcZOG3fZNd
// SIG // KEh88Ggx9KwWwFCoU5mosk7HIk6WUgEWmam860Y0+QLl
// SIG // nyV0bxoKm+AU2j+MNZ5PkWJbnd0CP0qdnGmxDc9/l9HN
// SIG // IYdFzEQw51chXMMnBxlRfRyN/GdrvJ02/x5cH9eTobpL
// SIG // KtHY4fpLUscxbXWbdS8oX54uMg+XjmvGKa4MKgR35p3S
// SIG // U4BcDn+9k4o3mf949h4/QtFyFlfRDofyf9mZI8yVuWLc
// SIG // w7znVDT1GZP9kYdr78V3L5YsOvBxjKRX2ZTL/hNvArDo
// SIG // W11Hpk8fEx0iLWmTxjaYL8bMKrQsKwfS5MV5DpDs1zcx
// SIG // GYRH/eYtZSFtpYeBfUVthyG9HbZv4G6n5g9HlD/QGFpo
// SIG // A3oAgF9waz67+cmggHLJkoDxxPIKadQj/i9boPi/LCDd
// SIG // cEV/h/YPAUfL96+wL7nwoyX6TbBrTlfaQrRP9sI8uFqi
// SIG // /1lfKhtrB804tgaJq4pPYVa9vBnMcgUJPGMHDDo+3m5G
// SIG // 8IT+OdRx//GGU4YyfqIo71e3j29lMTZJ8gGT/fiItNEE
// SIG // noftoY9NNCfNrc59a7X91HJwLpaXmiezc+OcZdNIpLFe
// SIG // WUk+aDpH+6Uaic/9QJignqY34ReN/IMs9cuqyv3X5VMb
// SIG // WtjNEKM/AEUAe/gQjBoTRqMKt/vl5QYjf6hdTRQ/quWh
// SIG // nzCCB3EwggVZoAMCAQICEzMAAAAVxedrngKbSZkAAAAA
// SIG // ABUwDQYJKoZIhvcNAQELBQAwgYgxCzAJBgNVBAYTAlVT
// SIG // MRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdS
// SIG // ZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9y
// SIG // YXRpb24xMjAwBgNVBAMTKU1pY3Jvc29mdCBSb290IENl
// SIG // cnRpZmljYXRlIEF1dGhvcml0eSAyMDEwMB4XDTIxMDkz
// SIG // MDE4MjIyNVoXDTMwMDkzMDE4MzIyNVowfDELMAkGA1UE
// SIG // BhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAOBgNV
// SIG // BAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29mdCBD
// SIG // b3Jwb3JhdGlvbjEmMCQGA1UEAxMdTWljcm9zb2Z0IFRp
// SIG // bWUtU3RhbXAgUENBIDIwMTAwggIiMA0GCSqGSIb3DQEB
// SIG // AQUAA4ICDwAwggIKAoICAQDk4aZM57RyIQt5osvXJHm9
// SIG // DtWC0/3unAcH0qlsTnXIyjVX9gF/bErg4r25PhdgM/9c
// SIG // T8dm95VTcVrifkpa/rg2Z4VGIwy1jRPPdzLAEBjoYH1q
// SIG // UoNEt6aORmsHFPPFdvWGUNzBRMhxXFExN6AKOG6N7dcP
// SIG // 2CZTfDlhAnrEqv1yaa8dq6z2Nr41JmTamDu6GnszrYBb
// SIG // fowQHJ1S/rboYiXcag/PXfT+jlPP1uyFVk3v3byNpOOR
// SIG // j7I5LFGc6XBpDco2LXCOMcg1KL3jtIckw+DJj361VI/c
// SIG // +gVVmG1oO5pGve2krnopN6zL64NF50ZuyjLVwIYwXE8s
// SIG // 4mKyzbnijYjklqwBSru+cakXW2dg3viSkR4dPf0gz3N9
// SIG // QZpGdc3EXzTdEonW/aUgfX782Z5F37ZyL9t9X4C626p+
// SIG // Nuw2TPYrbqgSUei/BQOj0XOmTTd0lBw0gg/wEPK3Rxjt
// SIG // p+iZfD9M269ewvPV2HM9Q07BMzlMjgK8QmguEOqEUUbi
// SIG // 0b1qGFphAXPKZ6Je1yh2AuIzGHLXpyDwwvoSCtdjbwzJ
// SIG // NmSLW6CmgyFdXzB0kZSU2LlQ+QuJYfM2BjUYhEfb3BvR
// SIG // /bLUHMVr9lxSUV0S2yW6r1AFemzFER1y7435UsSFF5PA
// SIG // PBXbGjfHCBUYP3irRbb1Hode2o+eFnJpxq57t7c+auIu
// SIG // rQIDAQABo4IB3TCCAdkwEgYJKwYBBAGCNxUBBAUCAwEA
// SIG // ATAjBgkrBgEEAYI3FQIEFgQUKqdS/mTEmr6CkTxGNSnP
// SIG // EP8vBO4wHQYDVR0OBBYEFJ+nFV0AXmJdg/Tl0mWnG1M1
// SIG // GelyMFwGA1UdIARVMFMwUQYMKwYBBAGCN0yDfQEBMEEw
// SIG // PwYIKwYBBQUHAgEWM2h0dHA6Ly93d3cubWljcm9zb2Z0
// SIG // LmNvbS9wa2lvcHMvRG9jcy9SZXBvc2l0b3J5Lmh0bTAT
// SIG // BgNVHSUEDDAKBggrBgEFBQcDCDAZBgkrBgEEAYI3FAIE
// SIG // DB4KAFMAdQBiAEMAQTALBgNVHQ8EBAMCAYYwDwYDVR0T
// SIG // AQH/BAUwAwEB/zAfBgNVHSMEGDAWgBTV9lbLj+iiXGJo
// SIG // 0T2UkFvXzpoYxDBWBgNVHR8ETzBNMEugSaBHhkVodHRw
// SIG // Oi8vY3JsLm1pY3Jvc29mdC5jb20vcGtpL2NybC9wcm9k
// SIG // dWN0cy9NaWNSb29DZXJBdXRfMjAxMC0wNi0yMy5jcmww
// SIG // WgYIKwYBBQUHAQEETjBMMEoGCCsGAQUFBzAChj5odHRw
// SIG // Oi8vd3d3Lm1pY3Jvc29mdC5jb20vcGtpL2NlcnRzL01p
// SIG // Y1Jvb0NlckF1dF8yMDEwLTA2LTIzLmNydDANBgkqhkiG
// SIG // 9w0BAQsFAAOCAgEAnVV9/Cqt4SwfZwExJFvhnnJL/Klv
// SIG // 6lwUtj5OR2R4sQaTlz0xM7U518JxNj/aZGx80HU5bbsP
// SIG // MeTCj/ts0aGUGCLu6WZnOlNN3Zi6th542DYunKmCVgAD
// SIG // sAW+iehp4LoJ7nvfam++Kctu2D9IdQHZGN5tggz1bSNU
// SIG // 5HhTdSRXud2f8449xvNo32X2pFaq95W2KFUn0CS9QKC/
// SIG // GbYSEhFdPSfgQJY4rPf5KYnDvBewVIVCs/wMnosZiefw
// SIG // C2qBwoEZQhlSdYo2wh3DYXMuLGt7bj8sCXgU6ZGyqVvf
// SIG // SaN0DLzskYDSPeZKPmY7T7uG+jIa2Zb0j/aRAfbOxnT9
// SIG // 9kxybxCrdTDFNLB62FD+CljdQDzHVG2dY3RILLFORy3B
// SIG // FARxv2T5JL5zbcqOCb2zAVdJVGTZc9d/HltEAY5aGZFr
// SIG // DZ+kKNxnGSgkujhLmm77IVRrakURR6nxt67I6IleT53S
// SIG // 0Ex2tVdUCbFpAUR+fKFhbHP+CrvsQWY9af3LwUFJfn6T
// SIG // vsv4O+S3Fb+0zj6lMVGEvL8CwYKiexcdFYmNcP7ntdAo
// SIG // GokLjzbaukz5m/8K6TT4JDVnK+ANuOaMmdbhIurwJ0I9
// SIG // JZTmdHRbatGePu1+oDEzfbzL6Xu/OHBE0ZDxyKs6ijoI
// SIG // Yn/ZcGNTTY3ugm2lBRDBcQZqELQdVTNYs6FwZvKhggNW
// SIG // MIICPgIBATCCAQGhgdmkgdYwgdMxCzAJBgNVBAYTAlVT
// SIG // MRMwEQYDVQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdS
// SIG // ZWRtb25kMR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9y
// SIG // YXRpb24xLTArBgNVBAsTJE1pY3Jvc29mdCBJcmVsYW5k
// SIG // IE9wZXJhdGlvbnMgTGltaXRlZDEnMCUGA1UECxMeblNo
// SIG // aWVsZCBUU1MgRVNOOjU1MUEtMDVFMC1EOTQ3MSUwIwYD
// SIG // VQQDExxNaWNyb3NvZnQgVGltZS1TdGFtcCBTZXJ2aWNl
// SIG // oiMKAQEwBwYFKw4DAhoDFQCGhXqvj0zgYF3jUrVFgHVn
// SIG // R/jO4KCBgzCBgKR+MHwxCzAJBgNVBAYTAlVTMRMwEQYD
// SIG // VQQIEwpXYXNoaW5ndG9uMRAwDgYDVQQHEwdSZWRtb25k
// SIG // MR4wHAYDVQQKExVNaWNyb3NvZnQgQ29ycG9yYXRpb24x
// SIG // JjAkBgNVBAMTHU1pY3Jvc29mdCBUaW1lLVN0YW1wIFBD
// SIG // QSAyMDEwMA0GCSqGSIb3DQEBCwUAAgUA7o5UUDAiGA8y
// SIG // MDI2MTAyOTIzMjUwNFoYDzIwMjYxMDMwMjMyNTA0WjB0
// SIG // MDoGCisGAQQBhFkKBAExLDAqMAoCBQDujlRQAgEAMAcC
// SIG // AQACAgohMAcCAQACAhI2MAoCBQDuj6XQAgEAMDYGCisG
// SIG // AQQBhFkKBAIxKDAmMAwGCisGAQQBhFkKAwKgCjAIAgEA
// SIG // AgMHoSChCjAIAgEAAgMBhqAwDQYJKoZIhvcNAQELBQAD
// SIG // ggEBALJYu+55/WlVUIjaoypx6Qi+AURG3GBm1N2m5Jic
// SIG // 7lPO2sFvKDrpj8nI33gtH/2QoBC+gFNzMzRf1C+Po4ZG
// SIG // h8ZObX8A73ChsQw2GGp28gLRZpaKhOGtcp38cZ7n3hiS
// SIG // hkM1/2v9TOvFYvsRs/cxxWxczCfu7Heg+OTXRfygA8SW
// SIG // Sz3JySAxxQEnQKa9/iQYETBDNe8yTpH7L4deAqPsfQGd
// SIG // 9PYnz4whmH4GMAMgoENyN+ZES3Ak/BvkMm81qit8uHPb
// SIG // +0J4ygquWIKF4k6Qg3zDaH2Mxi999kw9t2sGQ8bC2vXN
// SIG // TnjTmtZBJNuhAJZ56uyZrGffpDFTX7vYJ9GWBLcxggQN
// SIG // MIIECQIBATCBkzB8MQswCQYDVQQGEwJVUzETMBEGA1UE
// SIG // CBMKV2FzaGluZ3RvbjEQMA4GA1UEBxMHUmVkbW9uZDEe
// SIG // MBwGA1UEChMVTWljcm9zb2Z0IENvcnBvcmF0aW9uMSYw
// SIG // JAYDVQQDEx1NaWNyb3NvZnQgVGltZS1TdGFtcCBQQ0Eg
// SIG // MjAxMAITMwAAAhvQsrgCZ/dyzwABAAACGzANBglghkgB
// SIG // ZQMEAgEFAKCCAUowGgYJKoZIhvcNAQkDMQ0GCyqGSIb3
// SIG // DQEJEAEEMC8GCSqGSIb3DQEJBDEiBCDqH9ss7Fi7gc05
// SIG // 8QdWM/xZPfRIHk1mipr18q6lPoGwvzCB+gYLKoZIhvcN
// SIG // AQkQAi8xgeowgecwgeQwgb0EIDAlFJW4PaOYxxAIVd0u
// SIG // 4kDAOlRU1nptzp18lTzdDYuAMIGYMIGApH4wfDELMAkG
// SIG // A1UEBhMCVVMxEzARBgNVBAgTCldhc2hpbmd0b24xEDAO
// SIG // BgNVBAcTB1JlZG1vbmQxHjAcBgNVBAoTFU1pY3Jvc29m
// SIG // dCBDb3Jwb3JhdGlvbjEmMCQGA1UEAxMdTWljcm9zb2Z0
// SIG // IFRpbWUtU3RhbXAgUENBIDIwMTACEzMAAAIb0LK4Amf3
// SIG // cs8AAQAAAhswIgQgaiy4D/8u9mX2KqrYd9ZacyTnn0oQ
// SIG // JA+pg84GXCXJDTowDQYJKoZIhvcNAQELBQAEggIAR+rr
// SIG // M3IpnbD96fnuMPJ6JBo39AYWlV/i56TQMjfLAWaxxH95
// SIG // vRUVVkjGj53gDrEbSIJRne1BolfiATvHiV+2SNwfokR1
// SIG // THmMZeR/oy9+qbMF0FGj4xab+eFQwjlRWHb9h2pFvOot
// SIG // cug4C+B0Mt3KSuaaZLfBmHmxycI3uusWQgxFdVG5Xv+G
// SIG // sZ9eZrRF+KjAnqxY195Psq3CaW3Ygi/XSm0kvHZZAtaw
// SIG // XoyDirn4BUyyyH6hoxGtaLZhAagXGtEjWDxNOEqBN2zf
// SIG // ok6Xakidml4qjWCbvQL7nVrGKoHWdlMZ7BR4XBmVtBSX
// SIG // N9PlyaktSRNMqIBwCXDq5yhrwrax5Io1cCWaogls8RB9
// SIG // RnLc4ugqX6oHPqd8cCw1YKyj1T+JWzmsJNdH6fATAYGZ
// SIG // w8+FFrvnECMB3lRxGgTuxtzh/9TtroBL43y0xWmWXIjW
// SIG // ioiQ86lZO1l7UG7Bx4d//SgvmUTb1ekkz0ekq1aUT+8i
// SIG // G0EQCasENfeU9F6gfUrDFT/r8w6dS0fhmdAj+lmYhTPm
// SIG // wZYfrBQ9gjep5P37JupmSpmferY8I7abtAXIjxXz2Pv2
// SIG // 3FZiN533MM2SnXOGUu/1BwS/82maVWkVQ9Notio/VL0D
// SIG // ueG+lUwdwpsq4Qf/Edco2CDRmeGBxfNRYbJirQnL+2oR
// SIG // Au7Y8pE9Fh1v/kCJgpA=
// SIG // End signature block
