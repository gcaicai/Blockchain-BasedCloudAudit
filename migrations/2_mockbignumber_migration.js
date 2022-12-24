const MockBigNumber = artifacts.require("./MockBigNumber.sol");

module.exports = function (deployer) {
    deployer.deploy(MockBigNumber);
};
