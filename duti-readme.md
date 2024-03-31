# Duti things

## Bundle IDs

To get the bundle ID for an application, run (for example):

```shell
codesign -dv /Applications/BambuStudio.app 2>&1 | grep -E '^Identifier' | awk -F= '{print $2}'
```

Which outputs:

```text
com.bambulab.bambu-studio
```

## Finding a UTI (the filetype identifier)

```shell
$(fd lsregister /System/Library/Frameworks --case-sensitive -t file)  -dump \
    | rg '^uti:' \
    | awk '{ print $2 }' \
    | sort | uniq
```
