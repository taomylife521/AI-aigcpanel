const common = require("./common.cjs");

// electron-builder arch → 目录命名映射
const ARCH_MAP = { x64: "x86", arm64: "arm64", ia32: "x86" };

exports.default = async function (context) {
    // 使用 context.arch（目标架构）而非 process.arch（构建机架构），以支持交叉编译
    const targetArch = context.arch || common.platformArch();
    const platformName = common.platformName();
    const platformArch = ARCH_MAP[targetArch] || targetArch;
    const name = platformName + "-" + platformArch;

    console.log("BuildOptimize", { platformName, platformArch, targetArch, name });

    const srcDir = `electron/resources/extra/${name}`;
    let destDir = null;
    if (platformName === 'osx') {
        destDir = common.pathResolve(
            context.appOutDir,
            `${context.packager.appInfo.productFilename}.app`,
            "Contents",
            "Resources",
            "extra",
            name
        );
    } else if (platformName === 'win') {
        destDir = common.pathResolve(context.appOutDir, "resources", "extra", name);
    } else if (platformName === 'linux') {
        destDir = common.pathResolve(context.appOutDir, "resources", "extra", name);
    }

    console.log("BuildOptimize.copy", {
        platformName,
        platformArch,
        srcDir,
        destDir,
    });

    if (srcDir && common.exists(srcDir)) {
        console.log(`Copying from ${srcDir} to ${destDir}`);
        common.copy(srcDir, destDir, true);
        console.log(`Copy completed`);
    } else {
        console.log(`No matching source directory found for platform: ${platformName}-${platformArch}`);
    }

    // common.listFiles(context.appOutDir, true).forEach((p) => {
    // console.log('BuildOptimize.path', (p.isDir ? 'D:' : 'F:') + p.path);
    // })
    // const localeDir = context.appOutDir + "/AigcPanel.app/Contents/Frameworks/Electron Framework.framework/Versions/A/Resources/";
    // console.log(`localeDir: ${localeDir}`);
    // fs.readdir(localeDir, function (err, files) {
    //     if (!(files && files.length)) {
    //         return;
    //     }
    //     for (let f of files) {
    //         if (f.endsWith('.lproj')) {
    //             if (!(f.startsWith("en") || f.startsWith("zh"))) {
    //                 const p = localeDir + f;
    //                 console.log(`removeFile: ${p}`);
    //                 fs.rmdirSync(p, {recursive: true});
    //             }
    //         }
    //     }
    // });
};
