import { safePlayAudio } from '../safeAudio';

describe('safePlayAudio', () => {
    test('does not throw when audio play fails', () => {
        // Mock Audio
        const mockPlay = jest.fn().mockRejectedValue(new Error('NotAllowedError'));
        global.Audio = jest.fn().mockImplementation(() => ({
            play: mockPlay,
            volume: 0,
        }));

        expect(() => safePlayAudio('test.mp3')).not.toThrow();
    });

    test('sets volume to 0.5', () => {
        const mockAudio = { play: jest.fn().mockResolvedValue(), volume: 0 };
        global.Audio = jest.fn().mockImplementation(() => mockAudio);

        safePlayAudio('test.mp3');
        expect(mockAudio.volume).toBe(0.5);
    });
});