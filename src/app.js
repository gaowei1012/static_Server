//要创建一个服务器
// let config = require('./config');
let http = require('http');
let chalk = require('chalk');
let path = require('path');
let url = require('url');
let fs = require('fs');
let zlib = require('zlib');
let handlebars = require('handlebars');
let { promisify, inspect } = require('util');
let mime = require('mime');
let stat = promisify(fs.stat);
let readdir = promisify(fs.readdir);
//编译模板，得到一个渲染的方法,然后传入实际数据数据就可以得到渲染后的HTML了
function list() {
    let tmpl = fs.readFileSync(path.resolve(__dirname, 'template', 'list.html'), 'utf8');
    return handlebars.compile(tmpl);
}
//在代码内部是可以读到环境变量的值，当然也可以写入环境变量的值
//console.log(process.env);
//process.env.DEBUG = 'static:*';
//console.log(process.env);
//这是一个在控制台输出的模块,名称有特点有二部分组成，第一部分一般是项目名，第二模分是模块名
//每个debug实例都有一个名字，是否在控制台打印取决于环境变量中DEBUG的值是否等于static:app
let debug = require('debug')('static:app');
class Server {
    constructor(argv) {
        console.log(arguments)
        this.list = list();
        this.config = Object.assign({}, this.config, argv);
    }
    start() {
        let server = http.createServer();
        server.on('request', this.request.bind(this));
        server.listen(this.config.port, () => {
            let url = `http://${config.host}:${this.config.port}`;
            debug(`server started at ${chalk.green(url)}`);
        });
    }
    //静态文件服务器
    async request(req, res) {
        ///先取到客户端想说的文件或文件夹路径 
        // /images     my.jpg home
        let { pathname } = url.parse(req.url);
        if (pathname == '/favicon.ico') {
            return this.sendError(req, res);
        }
        let filepath = path.join(this.config.root, pathname);
        try {
            let statObj = await stat(filepath);
            if (statObj.isDirectory()) {//如果是目录的话，应该显示目录 下面的文件列表
                let files = await readdir(filepath);
                files = files.map(file => ({
                    name: file,
                    url: path.join(pathname, file)
                }));
                let html = this.list({
                    title: pathname,
                    files
                });
                res.setHeader('Content-Type', 'text/html');
                res.end(html);
            } else {
                this.sendFile(req, res, filepath, statObj);
            }
        } catch (e) {
            debug(inspect(e));//inspect把一个对象转成字符
            this.sendError(req, res);
        }
    }
    sendFile(req, res, filepath, statObj) {
        // 设置缓存,如果有缓存则跳过这里
        if (this.handleCache(req, res, filepath, statObj)) return;
        // 添加zlib压缩
        let encoding = this.getEncoding(req, res);
        if (encoding) {
            fs.createReadStream(filepath).pipe(encoding).pipe(res);
        } else {
            fs.createReadStream(filepath).pipe(res);
        }
        // 设置头部信息
        res.setHeader('Content-Type', mime.getType(filepath));// .jpg
        fs.createReadStream(filepath).pipe(res);
    }

    // zlib 压缩
    getEncoding(req, res) {
        let acceptEncoding = req.headers['accept-encoding'];
        if (/\bgzip\b/.test[acceptEncoding]) {
            res.setHeader('Content-Encoding', 'gzip');
            return zlib.createGzip();
        } else if (/\bdeflate\b/.test[acceptEncoding]) {
            res.setHeader('Content-Encoding', 'deflate');
            return zlib.createDeflate();
        } else {
            return null;
        }
    }

    // 设置缓存
    handleCache(req, res, filepath, statObj) {
        try {
            // 取到该字段
            let ifModifiedSince = req.headers['if-modified-since'];
            let isNoneMatch = req.headers['if-none-match'];
            res.setHeader('Cache-Control', 'private', 'max-age=30');
            res.setHeader('Expires', new Date(Date.now() + 30 * 1000).toGMTString());
            let etag = statObj.size;
            let lastModified = statObj.ctime.toGMTString();
            res.setHeader('ETag', etag);
            res.setHeader('Last-Modified', lastModified);
            // 拿到该字段是否和当前的字段是否相符
            if (isNoneMatch && isNodeMatch != etag) {
                return false;
            }
            if (ifModifiedSince && ifMofefiedSince != lastModified) {
                return false;
            }
            if (isNoneMatch || ifModifiedSince) {
                res.writeHead(304);
                res.end();
                return true;
            } else {
                return false;
            }

        } catch (e) {
            return new Error(e);
        }
    }

    sendError(req, res) {
        res.statusCode = 500;
        res.end(`there is something wrong in the server! please try later!`);
    }
}
// let server = new Server();
// server.start();//启动服务
//npm i supervisor -g

module.exports = Server;