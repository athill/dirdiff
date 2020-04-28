const chalk = require('chalk');
const { execSync } = require('child_process');
const { lstatSync } = require('fs');
const path = require('path');
const reader = require("readline-sync"); //npm install readline-sync

const usage = 'Usage: dirdiff <fromDir> <toDir>';

const error = (message) => console.error(chalk.red(message));

// validate and parse args
if (process.argv.length !== 4) {
    console.log(usage);
    process.exit(1);
};


let [ , , fromDir, toDir ]  = process.argv;

// helpers
const hasTree = (() => {
    try {
        execSync('which tree');
        return true;
    } catch (err) {
        return false;
    }
})();

const isDir = (path) => lstatSync(path).isDirectory();
const question = (options) => {
    const prompt = options.map(({ label, char }) => `${label} (${char})`).join(', ') + ':';
    const validResponses = options.map(({ char }) => char.toLowerCase());
    let valid = false;
    let response;
    while (!valid) {
        response = reader.question(prompt).toLowerCase();
        if (response && !validResponses.includes(response)) {
            error(`Invalid response: Valid responses are ${validResponses.join(', ')}`);
        } else {
            valid = true;
        }
    }
    return response;
};

const removeTrailingSlash = (string) => string.replace(/(.*)\/$/, '$1');
fromDir = removeTrailingSlash(fromDir);
toDir = removeTrailingSlash(toDir);

let diff;
try {
    diff = execSync(`diff -rq -x vendor -x node_modules ${fromDir} ${toDir}`);
} catch (err) {
    diff = err.stdout;
}
diff = diff.toString().split('\n');

const onlyInRegex = /Only in ([^:]+): (.*)/;
const filesRegex = /Files (\S+) and (\S+) differ/;

let dirOptions = [{ label: 'List', char: 'l'}];
if (hasTree) {
    dirOptions.push({ label: 'Tree', char: 't' });
}

// parse diff
diff.forEach(line => {
    if (line.startsWith('Files ')) {
        const [fromFile, toFile] = line.replace(filesRegex, (match, p1, p2) => [p1, p2]).split(',');
        console.log('Files', chalk.yellow(fromFile), 'and', chalk.green(toFile), 'differ.');
        const response = question([{ label: 'View Diff', char: 'v' }]);
        let diff;
        if (response === 'v') {
            try {
                diff = execSync(`diff ${fromFile} ${toFile}`);
            } catch (err) {
                diff = err.stdout;
            }            
            console.log(diff.toString());
        }
    } else if (line.startsWith('Only in ')) {
        const currentPath = line.replace(onlyInRegex, (match, p1, p2) => path.join(p1, p2));
        const colorer = currentPath.startsWith(`${fromDir}/`) ? chalk.yellow : chalk.green;
        console.log(colorer(line));
        if (isDir(currentPath)) {
            console.log(chalk.blue(`${currentPath} is a dir`));
            const response = question(dirOptions);
            let content;
            if (response === 'l') {
                console.log(execSync(`ls ${currentPath}`).toString());
            } else if (response === 't') {
                console.log(execSync(`tree ${currentPath}`).toString());
            }
        } else {
            const view = question([{ label: 'View File', char: 'v'}]) === 'v';
            if (view) {
                const contents = execSync(`cat ${currentPath}`).toString();
                console.log(contents);
            }
        }
    } 
});

