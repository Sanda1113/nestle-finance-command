const simulateBankTransfer = async (supplierAccount, amount) => {
  return new Promise((resolve) => {
    // Simulate a 2-second bank processing delay
    setTimeout(() => {
      resolve({
        success: true,
        transactionId: `TXN-BNK-${Math.floor(Math.random() * 1000000)}`,
        timestamp: new Date(),
        message: `Funds successfully routed to ${supplierAccount}`
      });
    }, 2000);
  });
};

module.exports = { simulateBankTransfer };
