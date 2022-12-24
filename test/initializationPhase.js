var Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:7545"));
const bn = require('bn.js');

var fs = require("fs");
var readLine = require("readline");
var ws = fs.createWriteStream("d:/sigiFilePath.txt");
var ws2 = fs.createWriteStream("e:/anotherSigiFilePath.txt");


/** 初始化阶段
 * 需要自己更改数据路径、智能合约的abi地址和address地址等信息
 * 用truffle migrate部署智能合约的需在truffle migrate后连接自动生成json文件中的abi和address信息才能实例化合约
 * cspAddr和调用智能合约时对应信息都需重新定义，因为ganache初始化时给出的10个address地址都不一样
 * bi数据存储为txt文件保存于本地，一个bi大小为4kb
 */

//用智能合约中的函数计算数字签名
var abi = [];
var contractAddress = "";
var myContract = new web3.eth.Contract(abi, contractAddress);//实例化合约

//公共参数：g,N
var g_val = "0x75048074384425574039e8f01894904b52af2c8b3f0fbb998dc4e72868a455402d62bb9354bb418a2a131468068c9e74fc543871e54ac9c6dedf2006815de2a67ddc496b11d13ab54a46ef83856f78938ea448727ee4dca715033008576fb9c5d28e039c827a420d33918579c2f9333db69ba1fe8af3ab5e49e968fde71a0371";
var g_extra = "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003ff";
var N_val = "0x26fa333d013980b6d7d96edb531b185bac02029a64cd156a925759ee6f0e0324e5432c84787c850719cf485bc4295398c62632773c46cf3479d475fe5dd8f4a39e51b7f8a66728003b2c5e940334380ee2961c7a3d610a2a703235532aa8332f63f51bc43ff08e4364d3b6f4b7ff18275027ebd9ae9526333950ba4c0c658ed4";
var N_extra = "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003fe";

var initResult1;
var initResult2;

var biArr = new Array();
var sigiArr = new Array();
var indexArrFromEvents = new Array();
var biArrByCSP = new Array();
var sigiArrByCSP = new Array();

var cspAddr = "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4";//需要自己指定目标CSP地址，此处仅是示例

entry();
async function entry() {

    await getBi();
    await genSigi();
    await getSigi();
    await emitSigiEvent();//用emit触发事件存储sigi

    //CSP验证sigi的正确性
    await getSigiEvent();

    await cmpSigi();

    await getBiByCSP();

    await genSigiByCSP();

    await getSigiByCSP();

    await cmpSigiByCSP();

    await refundByCSP();

}

async function refundByCSP() {
    if (initResult1 == true && initResult2 == true) {
        await new Promise(function (resolve, reject) {
            myContract.methods.refund(true).send({ from: "0xA79A18D8b3E8cFE452eF0d81Da1473Ed3C83f4D2" }, function (err, transHash) {
                if (!err) {
                    console.log(transHash);
                } else {
                    console.log(err);
                }
            });
        });
    } else {
        await new Promise(function (resolve, reject) {
            myContract.methods.refund(false).send({ from: "0xA79A18D8b3E8cFE452eF0d81Da1473Ed3C83f4D2" }, function (err, transHash) {
                if (!err) {
                    console.log(transHash);
                } else {
                    console.log(err);
                }
            });
        });
    }
}

async function cmpSigi() {
    var flag = 0;
    for (var i = 0; i < sigiArr.length; i++) {
        if (sigiArr[i] != indexArrFromEvents[i]) {
            flag = 1;//错误
            break;
        }
    }
    if (flag == 1) {
        initResult1 = false;
    } else {
        initResult1 = true;
    }
}

async function getSigiEvent() {
    var tempArr = new Array();
    await new Promise(function (resolve, reject) {
        //{ fromBlock: 0, toBlock: "latest" }根据需要更改
        myContract.getPastEvents("storeSigiEvent", { fromBlock: 0, toBlock: "latest" }, function (err, event) {
            if (!err) {
                for (var i = 0; i < event.length; i++) {
                    //可以通过event.length获取event个数,event[event.length - 1]可以获得最新的event
                    // index = event[event.length - 1].returnValues[i];
                    index = event[i].returnValues[0];
                    tempArr.push(index);//myContract调用的所有方法都不能传递出去，只能用then()才能传递参数出去并修改全局变量
                }
                resolve(tempArr);
            } else {
                console.log(err);
            }
        });
    }).then(function (value) {
        for (var i = 0; i < value.length; i++) {
            indexArrFromEvents[i] = value[i];
        }
    });
}

async function genSigi() {
    for (var i = 0; i < biArr.length; i++) {
        var bi_no = biArr[i];
        var bi_val = "0x" + biArr[i];
        var bi_extra = calExtra(bi_no);

        await new Promise(function (resolve, reject) {
            myContract.methods.mock_modexp(g_val, g_extra, bi_val, bi_extra, N_val, N_extra).call(function (err, result) {
                if (!err) {
                    resolve(result[0]);
                } else {
                    console.log(err);
                }
            });
        }).then(function (value) {
            ws.write(value + "\r\n");
        });
    }
}

//触发事件
async function emitSigiEvent() {
    for (var i = 0; i < sigiArr.length; i++) {
        var sigi_val = sigiArr[i];
        var sigi_no = sigi_val.slice(2, sigi_val.length);
        var sigi_extra = calExtra(sigi_no);

        //参数个数和类型与SC中对应function的参数对应，传参过多会导致out of gas或runtime error的错误
        //参数{ from: "0xA79A18D8b3E8cFE452eF0d81Da1473Ed3C83f4D2", value: "3000000000" }需要自己更改
        await new Promise(function (resolve, reject) {
            myContract.methods.storeSigi(cspAddr, sigi_val, sigi_extra).send({ from: "0xA79A18D8b3E8cFE452eF0d81Da1473Ed3C83f4D2", value: "3000000000" }, function (err, transHash) {
                if (!err) {
                    console.log("transHash=" + transHash);
                } else {
                    console.log(err);
                }
            });
        });
    }
}

async function getSigi() {
    var readObj = readLine.createInterface({
        input: fs.createReadStream("d:/sigiFilePath.txt")
    });
    var tempArr = new Array();

    await new Promise(function (resolve, reject) {
        readObj.on("line", function (line) {
            tempArr.push(line);
        }).on("close", function () {
            resolve(tempArr);
        });
    }).then(function (value) {
        for (var i = 0; i < value.length; i++) {
            sigiArr.push(value[i]);
        }
    });
}

async function getBi() {
    var readObj = readLine.createInterface({
        input: fs.createReadStream("d:/dataFilePath.txt")
    });
    var tempArr = new Array();

    await new Promise(function (resolve, reject) {
        readObj.on("line", function (line) {
            tempArr.push(line);
        }).on("close", function () {
            resolve(tempArr);
        });
    }).then(function (value) {
        for (var i = 0; i < value.length; i++) {
            biArr.push(value[i]);
        }
    });
}

async function getBiByCSP() {
    var readObj = readLine.createInterface({
        input: fs.createReadStream("e:/anotherDataFilePath.txt")
    });
    var tempArr = new Array();

    await new Promise(function (resolve, reject) {
        readObj.on("line", function (line) {
            tempArr.push(line);
        }).on("close", function () {
            resolve(tempArr);
        });
    }).then(function (value) {
        for (var i = 0; i < value.length; i++) {
            biArrByCSP.push(value[i]);
        }
    });
}

async function genSigiByCSP() {
    for (var i = 0; i < biArrByCSP.length; i++) {
        var bi_no = biArrByCSP[i];
        var bi_val = "0x" + biArrByCSP[i];
        var bi_extra = calExtra(bi_no);

        await new Promise(function (resolve, reject) {
            myContract.methods.mock_modexp(g_val, g_extra, bi_val, bi_extra, N_val, N_extra).call(function (err, result) {
                if (!err) {
                    resolve(result[0]);
                } else {
                    console.log(err);
                }
            });
        }).then(function (value) {
            ws2.write(value + "\r\n");
        });
    }
}

async function getSigiByCSP() {
    var readObj = readLine.createInterface({
        input: fs.createReadStream("e:/anotherSigiFilePath.txt")
    });
    var tempArr = new Array();

    await new Promise(function (resolve, reject) {
        readObj.on("line", function (line) {
            tempArr.push(line);
        }).on("close", function () {
            resolve(tempArr);
        });
    }).then(function (value) {
        for (var i = 0; i < value.length; i++) {
            sigiArrByCSP.push(value[i]);
        }
    });
}

async function cmpSigi() {
    var flag = 0;
    for (var i = 0; i < sigiArrByCSP.length; i++) {
        if (sigiArrByCSP[i] != indexArrFromEvents[i]) {
            flag = 1;//错误
            break;
        }
    }
    if (flag == 1) {
        initResult2 = false;
    } else {
        initResult2 = true;
    }
}

//计算extra部分，传参para没有0x开头，返回第二个参数
function calExtra(para) {
    var a_val = para;//a是底数，没有0x
    var a_bn = new bn(a_val, 16);
    var a_neg = false;
    var a_msb = a_bn.bitLength();
    var a_msb_enc = "0".repeat(64 - a_bn.bitLength().toString(16).length) + a_bn.bitLength().toString(16);
    var a_val_enc = "0x" + a_val;
    var a_extra_enc = "0x" + "0".repeat(63) + ((a_neg == true) ? "1" : "0") + a_msb_enc;
    // console.log("calExponent中的第二个参数：" + a_extra_enc);
    return a_extra_enc;
}


