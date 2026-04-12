rule polinrider: polinrider {
  meta:
    description  = "PolinRider, based on https://github.com/OpenSourceMalware/PolinRider"
    threat_level = 3
    in_the_wild  = true
    author       = "yaleman"

  strings:
    // npm package	tailwind-mainanimation	Removed malicious package
    // npm package	tailwind-autoanimation	Malicious package
    $pkg    = "tailwind-(main|auto)animation"
    // npm package	tailwindcss-style-animate	Malicious dependency (ShoeVista)
    // npm package	tailwindcss-style-modify	Malicious package
    // npm package	tailwindcss-typography-style	Malicious package
    $pkgcss = "tailwindcss-(style-animate|style-modify|typography-style)"

    $rmcej                          = "rmcej%otb%"  // Original obfuscation marker
    $obfus2                         = "Cot%3t=shtP"  // New obfuscation marker
    // $global['_V']	Variant indicator
    $decoder1                       = "_$_1e42"  // Decoder function (v1)
    $decoder2                       = "MDy"  //Decoder function (v2)
    $stakinggame                    = "e9b53a7c-2342-4b15-b02d-bd8b8f6a03f9"  // StakingGame template identifier
    $api_trongrid_io                = "api.trongrid.io"  // TRON API used for payload retrieval
    $fullnode_mainnet_aptoslabs_com = "fullnode.mainnet.aptoslabs.com"  // Aptos fallback C2

  condition:
    $pkg
    or $pkgcss
    or $rmcej
    or $decoder1
    or $obfus2
    or $decoder2
    or $stakinggame
    or $api_trongrid_io
    or $fullnode_mainnet_aptoslabs_com
}
