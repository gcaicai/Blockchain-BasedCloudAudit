pragma solidity >=0.4.20 <0.9.0;

import "./BigNumber.sol";

/*
 * mock contract to access BigNumber library for testing.
 * Library is mostly internal functions and tf. requires a contract to instantiate it to be used.
 * js file in ../test directory instantiates and uses this contract.
 */

contract MockBigNumber {
    using BigNumber for *;

    //g ang N are two public parameters
    bytes g_val =
        "0x75048074384425574039e8f01894904b52af2c8b3f0fbb998dc4e72868a455402d62bb9354bb418a2a131468068c9e74fc543871e54ac9c6dedf2006815de2a67ddc496b11d13ab54a46ef83856f78938ea448727ee4dca715033008576fb9c5d28e039c827a420d33918579c2f9333db69ba1fe8af3ab5e49e968fde71a0371";
    bytes g_extra =
        "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003ff";
    bytes N_val =
        "0x26fa333d013980b6d7d96edb531b185bac02029a64cd156a925759ee6f0e0324e5432c84787c850719cf485bc4295398c62632773c46cf3479d475fe5dd8f4a39e51b7f8a66728003b2c5e940334380ee2961c7a3d610a2a703235532aa8332f63f51bc43ff08e4364d3b6f4b7ff18275027ebd9ae9526333950ba4c0c658ed4";
    bytes N_extra =
        "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003fe";

    bool public isAudit = false; //审计周期是否开启标志，默认为false

    //预先规定的附加费用，最小单位为Wei，价格可以自定义
    uint256 public addExpense = 1000;
    uint256 public depositDO;

    //目标CSP地址和DO地址
    address payable public CSPAddr;
    address payable public DOAddr;

    event storeSigiEvent(bytes, bytes); //存储sigi，事件中数据个数和类型可以自定义
    event storeAuditInfos(bytes, bytes); //存储sigi+chali，事件中数据个数和类型可以自定义
    event storeAuditResult(bool); //存储验证结果

    bytes[] sigiArr;
    bytes[] private riArr;
    bytes[] private sigmaiArr;

    //calls prepare_add, and by extension bn_add and bn_sub
    function mock_bn_add(
        bytes memory a_val,
        bool a_neg,
        uint256 a_bitlen,
        bytes memory b_val,
        bool b_neg,
        uint256 b_bitlen
    )
        public
        pure
        returns (
            bytes memory,
            bool,
            uint256
        )
    {
        BigNumber.instance memory a = BigNumber.instance(
            a_val,
            a_neg,
            a_bitlen
        );
        BigNumber.instance memory b = BigNumber.instance(
            b_val,
            b_neg,
            b_bitlen
        );
        BigNumber.instance memory res = a.prepare_add(b);

        return (res.val, res.neg, res.bitlen);
    }

    //calls bn_mul, and by extension add, sub and right_shift.
    function mock_bn_mul(
        bytes memory a_val,
        bool a_neg,
        uint256 a_bitlen,
        bytes memory b_val,
        bool b_neg,
        uint256 b_bitlen
    )
        public
        view
        returns (
            bytes memory,
            bool,
            uint256
        )
    {
        BigNumber.instance memory a = BigNumber.instance(
            a_val,
            a_neg,
            a_bitlen
        );
        BigNumber.instance memory b = BigNumber.instance(
            b_val,
            b_neg,
            b_bitlen
        );
        BigNumber.instance memory res = a.bn_mul(b);

        return (res.val, res.neg, res.bitlen);
    }

    //stack too deep error when passing in 9 distinct variables as arguments where 3 bignums are expected.
    //instead we encode each bitlen/neg value in a bytes array and decode.
    function mock_modexp(
        bytes memory a_val,
        bytes memory a_extra,
        bytes memory b_val,
        bytes memory b_extra,
        bytes memory mod_val,
        bytes memory mod_extra
    )
        public
        view
        returns (
            bytes memory,
            bool,
            uint256
        )
    {
        BigNumber.instance memory a;
        BigNumber.instance memory b;
        BigNumber.instance memory modd;

        uint256 neg;
        uint256 bitlen;

        assembly {
            neg := mload(add(a_extra, 0x20))
            bitlen := mload(add(a_extra, 0x40))
        }

        a.val = a_val;
        a.bitlen = bitlen;
        a.neg = (neg == 1) ? true : false;

        assembly {
            neg := mload(add(b_extra, 0x20))
            bitlen := mload(add(b_extra, 0x40))
        }

        b.val = b_val;
        b.bitlen = bitlen;
        b.neg = (neg == 1) ? true : false;

        assembly {
            neg := mload(add(mod_extra, 0x20))
            bitlen := mload(add(mod_extra, 0x40))
        }

        modd.val = mod_val;
        modd.bitlen = bitlen;
        modd.neg = (neg == 1) ? true : false;

        BigNumber.instance memory res = a.prepare_modexp(b, modd);

        return (res.val, res.neg, res.bitlen);
    }

    //stack too deep error when passing in 9 distinct variables as arguments where 3 bignums are expected.
    //instead we encode each bitlen/neg value in a bytes array and decode.
    function mock_modmul(
        bytes memory a_val,
        bytes memory a_extra,
        bytes memory b_val,
        bytes memory b_extra,
        bytes memory mod_val,
        bytes memory mod_extra
    )
        public
        view
        returns (
            bytes memory,
            bool,
            uint256
        )
    {
        BigNumber.instance memory a;
        BigNumber.instance memory b;
        BigNumber.instance memory modd;

        uint256 neg;
        uint256 bitlen;

        assembly {
            neg := mload(add(a_extra, 0x20))
            bitlen := mload(add(a_extra, 0x40))
        }

        a.val = a_val;
        a.bitlen = bitlen;
        a.neg = (neg == 1) ? true : false;

        assembly {
            neg := mload(add(b_extra, 0x20))
            bitlen := mload(add(b_extra, 0x40))
        }

        b.val = b_val;
        b.bitlen = bitlen;
        b.neg = (neg == 1) ? true : false;

        assembly {
            neg := mload(add(mod_extra, 0x20))
            bitlen := mload(add(mod_extra, 0x40))
        }

        modd.val = mod_val;
        modd.bitlen = bitlen;
        modd.neg = (neg == 1) ? true : false;

        BigNumber.instance memory res = a.modmul(b, modd);

        return (res.val, res.neg, res.bitlen);
    }

    //下面都是自己写的代码
    //触发事件存储签名，传入参数个数和类型可以自己修改
    function storeSigi(
        address payable cspAddr,
        bytes memory s_val,
        bytes memory s_extra
    ) public payable {
        require(
            msg.value != 0 && s_val.length != 0 && s_extra.length != 0,
            "Error!"
        );
        emit storeSigiEvent(s_val, s_extra);
        CSPAddr = payable(cspAddr);
        DOAddr = payable(msg.sender);
        CSPAddr.transfer(msg.value - addExpense);
    }

    //CSP根据验证结果需要退还DO费用
    function refund(bool initResult) public payable {
        if (initResult == true) {
            DOAddr.transfer(addExpense);
        } else {
            require(msg.value > 0, "Error!");
            DOAddr.transfer(msg.value + addExpense);
        }
    }

    //计算挑战信息，传参个数可改
    function chalGen(bytes memory s_val) public payable {
        require(
            isAudit == false && msg.value > 0 && s_val.length != 0,
            "Error!"
        );

        isAudit = true;
        depositDO = msg.value;

        BigNumber.instance memory r = riGen();

        BigNumber.instance memory g;
        BigNumber.instance memory modd;
        uint256 neg;
        uint256 bitlen;

        assembly {
            neg := mload(add(g_extra.slot, 0x20))
            bitlen := mload(add(g_extra.slot, 0x40))
        }

        g.val = g_val;
        g.bitlen = bitlen;
        g.neg = (neg == 1) ? true : false;

        assembly {
            neg := mload(add(N_extra.slot, 0x20))
            bitlen := mload(add(N_extra.slot, 0x40))
        }

        modd.val = N_val;
        modd.bitlen = bitlen;
        modd.neg = (neg == 1) ? true : false;

        BigNumber.instance memory chali = g.prepare_modexp(r, modd);

        CSPAddr.transfer(msg.value);

        emit storeAuditInfos(s_val, chali.val); //触发事件存储sigi+chali

        sigiArr.push(s_val); //若有多个传参则需写for循环依次存入sigi
        riArr.push(r.val); //ri个数和sigi个数相同
    }

    //计算一个随机数
    function riGen() internal returns (BigNumber.instance memory) {
        //需要计算随机数，keccak256()返回的是32字节--256 bit的数据，需要用乘 法扩展为500bit以上的数据，因为solidity没有字符串拼接函数
        bytes32 randNumber1 = bytes32(
            keccak256(
                abi.encodePacked(block.timestamp, block.difficulty, msg.sender)
            )
        );

        bytes32 randNumber2 = bytes32(
            keccak256(
                abi.encodePacked(block.difficulty, block.timestamp, msg.sender)
            )
        );

        BigNumber.instance memory r1;
        r1.val = abi.encodePacked(randNumber1);
        r1.neg = false;
        r1.bitlen = r1.val.length;

        BigNumber.instance memory r2;
        r2.val = abi.encodePacked(randNumber2);
        r2.neg = false;
        r2.bitlen = r2.val.length;

        return BigNumber.bn_mul4(r1, r2); //4*r1*r2，模数为0x00，此处的r作为随机数已达到长度安全要求
    }

    //stack too deep error when passing in 9 distinct variables as arguments where 3 bignums are expected.
    //instead we encode each bitlen/neg value in a bytes array and decode.
    //用来供js调用，计算 4*A1*A2 mod N
    function mock_modmul4(
        bytes memory a_val,
        bytes memory a_extra,
        bytes memory b_val,
        bytes memory b_extra,
        bytes memory mod_val,
        bytes memory mod_extra
    )
        public
        view
        returns (
            bytes memory,
            bool,
            uint256
        )
    {
        BigNumber.instance memory a;
        BigNumber.instance memory b;
        BigNumber.instance memory modd;

        uint256 neg;
        uint256 bitlen;

        assembly {
            neg := mload(add(a_extra, 0x20))
            bitlen := mload(add(a_extra, 0x40))
        }

        a.val = a_val;
        a.bitlen = bitlen;
        a.neg = (neg == 1) ? true : false;

        assembly {
            neg := mload(add(b_extra, 0x20))
            bitlen := mload(add(b_extra, 0x40))
        }

        b.val = b_val;
        b.bitlen = bitlen;
        b.neg = (neg == 1) ? true : false;

        assembly {
            neg := mload(add(mod_extra, 0x20))
            bitlen := mload(add(mod_extra, 0x40))
        }

        modd.val = mod_val;
        modd.bitlen = bitlen;
        modd.neg = (neg == 1) ? true : false;

        BigNumber.instance memory res = a.modmul4(b, modd);

        return (res.val, res.neg, res.bitlen);
    }

    //验证证明
    function verify(bytes memory proof) public payable {
        //调用其他函数计算sigma
        require(msg.value > 0 && isAudit == true, "Error!");
        calSigmai();
        bytes memory sigma = calSigma();

        //bytes对比
        bytes32 keccakProof = keccak256(abi.encodePacked(proof));
        bytes32 keccakSigma = keccak256(abi.encodePacked(sigma));

        if (keccakProof == keccakSigma) {
            //验证成功
            emit storeAuditResult(true);
            CSPAddr.transfer(depositDO + msg.value); //转账金额需协商
        } else {
            //验证失败
            emit storeAuditResult(false);
            DOAddr.transfer(depositDO + msg.value); //转账金额需协商
        }

        reset(); //重置部分参数
    }

    //计算sigma
    function calSigma() internal returns (bytes memory) {
        BigNumber.instance memory tempValue;
        tempValue.val = abi.encodePacked(sigmaiArr[0]);
        tempValue.neg = false;
        tempValue.bitlen = tempValue.val.length;

        for (uint256 i = 1; i < sigmaiArr.length; i++) {
            BigNumber.instance memory rightValue;
            rightValue.val = abi.encodePacked(sigmaiArr[i]);
            rightValue.neg = false;
            rightValue.bitlen = rightValue.val.length;

            //乘法
            BigNumber.instance memory temp = BigNumber.bn_mul4(
                tempValue,
                rightValue
            ); //4*r1*r2，模数为0x00，此处的r作为随机数已达到长度安全要求

            tempValue.val = abi.encodePacked(temp.val);
            tempValue.neg = false;
            tempValue.bitlen = tempValue.val.length;
        }

        return tempValue.val;
    }

    //计算sigmai
    function calSigmai() internal {
        BigNumber.instance memory module;
        module.val = N_val;
        module.neg = false;
        module.bitlen = N_val.length;

        //按顺序取出sigis中的元素，里面存的是bytes
        for (uint256 i = 0; i < sigiArr.length; i++) {
            BigNumber.instance memory base;
            base.val = abi.encodePacked(sigiArr[i]);
            base.neg = false;
            base.bitlen = base.val.length;

            BigNumber.instance memory exp;
            exp.val = abi.encodePacked(riArr[i]);
            exp.neg = false;
            exp.bitlen = exp.val.length;

            BigNumber.instance memory sigmai = base.prepare_modexp(exp, module);

            sigmaiArr.push(sigmai.val);
        }
    }

    //审计结束后重置部分参数
    function reset() public payable {
        isAudit = false;
        depositDO = 0;
        CSPAddr = payable(address(0x0));
        DOAddr = payable(address(0x0));
        bytes[] memory arr;
        sigiArr = arr;
        riArr = arr;
        sigmaiArr = arr;
    }
}
