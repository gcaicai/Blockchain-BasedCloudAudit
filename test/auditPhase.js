var Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:7545"));
const bn = require('bn.js');

var fs = require("fs");
var readLine = require("readline");

/** 审计阶段
 * 需要自己更改数据路径、智能合约的abi地址和address地址等信息
 * 用truffle migrate部署智能合约的需在truffle migrate后连接自动生成json文件中的abi和address信息才能实例化合约
 * cspAddr和调用智能合约时对应信息都需重新定义，因为ganache初始化时给出的10个address地址都不一样
 * bi数据存储为txt文件保存于本地，一个bi大小为4kb
 */

//创建合约实例
var abi = [];//对应部署合约后对应abi的.json文件
var contractAddress = "";//部署合约后的合约地址
var myContract = new web3.eth.Contract(abi, contractAddress);//实例化合约

//公共参数：g,N
var g_val = "0x75048074384425574039e8f01894904b52af2c8b3f0fbb998dc4e72868a455402d62bb9354bb418a2a131468068c9e74fc543871e54ac9c6dedf2006815de2a67ddc496b11d13ab54a46ef83856f78938ea448727ee4dca715033008576fb9c5d28e039c827a420d33918579c2f9333db69ba1fe8af3ab5e49e968fde71a0371";
var g_extra = "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003ff";
var N_val = "0x26fa333d013980b6d7d96edb531b185bac02029a64cd156a925759ee6f0e0324e5432c84787c850719cf485bc4295398c62632773c46cf3479d475fe5dd8f4a39e51b7f8a66728003b2c5e940334380ee2961c7a3d610a2a703235532aa8332f63f51bc43ff08e4364d3b6f4b7ff18275027ebd9ae9526333950ba4c0c658ed4";
var N_extra = "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003fe";

var num;
var auditNum = 10;//抽样审计个数，可自定义

var proof;
var orderArr = new Array();
var sigiArr = new Array();
var sigiArrFromEvents = new Array();
var chaliArrFromEvents = new Array();
var biArrByCSP = new Array();
var proofiArr = new Array();


entry();//函数入口
async function entry() {
    // await obtainDataNumber();

    //DO挑选sigi发送给SC
    await calOrderArr();
    await storeSigiArr(orderArr);
    //SC计算chali并触发事件存储
    await emitChaliGenEvent();

    //CSP查询事件获取sigi和chali
    await getSigiChaliEvent();

    //CSP据此计算proof
    await getBiByCSP(orderArr);
    await calProofi();
    //计算proof = 连乘积 (proofi mod N)
    await calProof();

    //CSP发送proof给SC验证
    await verifyProof();

    //查询结果
    await getResult();
}

//查询结果
async function getResult() {
    await new Promise(function (resolve, reject) {
        //{ fromBlock: 0, toBlock: "latest" }根据需要更改
        myContract.storeAuditResult("storeSigiEvent", { fromBlock: 0, toBlock: "latest" }, function (err, event) {
            if (!err) {
                //可以通过event.length获取event个数,event[event.length - 1]可以获得最新的event
                var res = event[event.length - 1].returnValues[0];
                resolve(res);
            } else {
                console.log(err);
            }
        });
    }).then(function (value) {
        console.log("audit result = " + value);
    });
}

async function verifyProof() {
    await new Promise(function (resolve, reject) {
        //参数{ from: "0xA79A18D8b3E8cFE452eF0d81Da1473Ed3C83f4D2", value: "3000000000" }需要自己更改
        myContract.methods.verify(proof).send({ from: "0xA79A18D8b3E8cFE452eF0d81Da1473Ed3C83f4D2", value: "3000000000" }, function (err, transHash) {
            if (!err) {
                console.log("transHash=" + transHash);
            } else {
                console.log(err);
            }
        });
    });
}

//计算一次 4*a*b mod N 之前的预处理
async function calProof() {
    var proofi1_no = proofiArr[0].slice(2, proofiArr[0].length);
    var proofi1_val = proofiArr[0];
    var proofi1_extra = calExtra(proofi1_no);

    for (var i = 0; ; i++) {
        var j = i + 1;

        var proofi2_no = proofiArr[j].slice(2, proofiArr[j].length);
        var proofi2_val = proofiArr[j];
        var proofi2_extra = calExtra(proofi2_no);

        await calOneMul(proofi1_val, proofi1_extra, proofi2_val, proofi2_extra);
        //最后的结果放在proof中

        //重置计算顺序
        if (j >= auditNum - 1) {
            break;//若j为9，到这里已经计算过一次乘法了，不能再重置顺序了
        } else {
            var proofi1_no = mulTempValue.slice(2, mulTempValue.length);
            var proofi1_val = mulTempValue;
            var proofi1_extra = calExtra(proofi1_no);

            var proofi2_no = proofiArr[j].slice(2, proofiArr[j].length);
            var proofi2_val = proofiArr[j];
            var proofi2_extra = calExtra(proofi2_no);
        }
    }
}

//计算一次乘法：4*a*b mod N，因为用call()计算 a*b mod N 会导致runTimeOut的报错，不影响结果
async function calOneMul(a_val, a_extra, b_val, b_extra) {
    await new Promise(function (resolve, reject) {
        myContract.methods.mock_modmul4(a_val, a_extra, b_val, b_extra, N_val, N_extra).call(function (err, result) {
            if (!err) {
                resolve(result[0]);
            } else {
                console.log(err);
            }
        });
    }).then(function (value) {
        proof = value;
    });
}

//计算proofi=chali^bi mod N并存储
async function calProofi() {
    for (var i = 0; i < chaliArrFromEvents.length; i++) {
        //预处理chali计算extra部分的值
        var chali_no = chaliArrFromEvents[i].slice(2, chaliArrFromEvents[i].length);//剔除0x
        var chali_val = chaliArrFromEvents[i];//带有0x
        var chali_extra = calExtra(chali_no);//最后结果带有0x
        var bi_no = biArrByCSP[i];
        var bi_val = "0x" + bi_no;
        var bi_extra = calExtra(bi_no);

        await calExpForProofi(chali_val, chali_extra, bi_val, bi_extra);
    }
}

//模幂运算---为计算proofi
async function calExpForProofi(base_val, base_extra, expo_val, expo_extra) {
    await new Promise(function (resolve, reject) {
        myContract.methods.mock_modexp(base_val, base_extra, expo_val, expo_extra, N_val, N_extra).call({ from: "0xA79A18D8b3E8cFE452eF0d81Da1473Ed3C83f4D2" }, function (err, result) {
            if (result != undefined) {
                resolve(result[0]);
            } else {
                console.log(err);
            }
        });
    }).then(function (value) {
        proofiArr.push(value);//存入数组
    });
}

//用于筛选并存储bi
async function getBiByCSP(arr) {
    var readObj2 = readLine.createInterface({
        input: fs.createReadStream("e:/anotherDataFilePath.txt")
    });
    var tempArr = new Array();
    var i = 0, c = 0;
    await new Promise(function (resolve, reject) {
        readObj2.on("line", function (line) {
            if (arr[i] == c) {
                tempArr.push(line);
                i++;
            }
            c++;
        }).on("close", function () {
            resolve(tempArr);
        });
    }).then(function (arrValue) {
        for (var j = 0; j < tempArr.length; j++) {
            biArrByCSP.push(arrValue[j]);//赋值全局变量
        }
    });
}

async function getSigiChaliEvent() {
    var sigiTempArr = new Array();
    var chaliTempArr = new Array();
    var tempArr = new Array();
    await new Promise(function (resolve, reject) {
        //{ fromBlock: 0, toBlock: "latest" }根据需要更改
        myContract.getPastEvents("storeAuditInfos", { fromBlock: 0, toBlock: "latest" }, function (err, event) {
            if (!err) {
                for (var i = 0; i < event.length; i++) {
                    //可以通过event.length获取event个数,event[event.length - 1]可以获得最新的event
                    // index = event[event.length - 1].returnValues[i];
                    let strSigi = event[i].returnValues[0];
                    let strChali = event[i].returnValues[1];

                    sigiTempArr.push(strSigi);//myContract调用的所有方法都不能传递出去，只能用then()才能传递参数出去并修改全局变量
                    chaliTempArr.push(strChali);//myContract调用的所有方法都不能传递出去，只能用then()才能传递参数出去并修改全局变量
                }

                tempArr = sigiTempArr.concat("0x00").concat(chaliTempArr);
                resolve(tempArr);
            } else {
                console.log(err);
            }
        });
    }).then(function (value) {
        var flag = 0;
        var j = 0;
        for (var i = 0; i < value.length; i++) {
            if (value[i] == "0x00") {
                flag = 1;
                i++;
            }
            if (flag == 0) {
                sigiArrFromEvents[i] = value[i];
            } else {
                chaliArrFromEvents[j] = value[i];
                j++;
            }
        }
    });
}

//触发事件
async function emitChaliGenEvent() {
    for (var i = 0; i < sigiArr.length; i++) {
        var sigi_val = sigiArr[i];

        //参数个数和类型与SC中对应function的参数对应，传参过多会导致out of gas或runtime error的错误
        //参数{ from: "0xA79A18D8b3E8cFE452eF0d81Da1473Ed3C83f4D2", value: "3000000000" }
        await new Promise(function (resolve, reject) {
            myContract.methods.chalGen(sigi_val).send({ from: "0xA79A18D8b3E8cFE452eF0d81Da1473Ed3C83f4D2", value: "3000000000" }, function (err, transHash) {
                if (!err) {
                    console.log("transHash=" + transHash);
                } else {
                    console.log(err);
                }
            });
        });
    }
}

//用于筛选并存储sigi
//还要将被挑选出来的sigi用send()方法触发事件存入区块链
async function storeSigiArr(arr) {
    var readObj1 = readLine.createInterface({
        input: fs.createReadStream("d:/sigiFilePath.txt")
    });
    var tempArr = new Array();
    var i = 0, c = 0;
    await new Promise(function (resolve, reject) {
        readObj1.on("line", function (line) {
            if (arr[i] == c) {
                tempArr.push(line);
                i++;
            }
            c++;
        }).on("close", function () {
            resolve(tempArr);
        });
    }).then(function (arrValue) {
        for (var j = 0; j < tempArr.length; j++) {
            sigiArr.push(arrValue[j]);
        }
    });
}

async function calOrderArr() {
    //根据num计算10个随机数，按顺序存入orderArr
    //这里会有重复的值，导致readLine中有空缺的值，想办法去重
    for (var i = 0; ; ++i) {
        if (orderArr.length < auditNum) {
            var index = Math.floor(Math.random() * num);//这个随机数是索引值随机数，均衡取值[0,99]
            if (orderArr.includes(index) == false) {
                //如果没有重复的值，则存入
                orderArr.push(index);
            }
        } else {
            break;
        }
    }
    orderArr.sort(function (a, b) {
        return a - b;
    });//数字的升序排序
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

//获取数据条数总数
async function obtainDataNumber() {
    var readObj1 = readLine.createInterface({
        input: fs.createReadStream("d:/dataFilePath.txt")
    });
    var c = 0;
    await new Promise(function (resolve, reject) {
        readObj1.on("line", function (line) {
            c++;//可以传出数据再进行处理，但是不能赋值给其他作用域变量
            //且传出的数据不能赋值给全局变量
        }).on("close", function () {
            resolve(c);
        });
    }).then(function (value) {
        console.log("2==" + value);//这里访问的num=undefined
        //传入这里的数据可以赋值给全局变量
        num = value;
    });
}


