module.exports = {
    Client: jest.fn().mockImplementation(() => ({
        enqueueAndGetResult: jest.fn().mockResolvedValue({
            document: {
                inference: {
                    prediction: {
                        fields: {},
                    },
                },
            },
        }),
    })),
    product: {
        Extraction: 'extraction',
    },
    BufferInput: jest.fn(),
};