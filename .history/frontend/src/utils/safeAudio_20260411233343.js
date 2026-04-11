export const safePlayAudio = (url) => {
    try {
        const audio = new Audio(url);
        audio.volume = 0.5;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => {
                // Autoplay blocked – ignore silently
            });
        }
    } catch (e) {
        // Audio not supported
    }
};