"""Audio processing utilities — VAD, noise suppression, and speaker verification.

Includes:
  - Noise gate + spectral subtraction
  - Enhanced VAD with energy + ZCR + spectral flatness
  - MFCC-based speaker verification (server-side backup for client-side voice lock)
"""

import numpy as np
import struct
import io


# ─── Constants ─────────────────────────────────────────────────────────────────

FFT_SIZE = 512
NUM_MEL_FILTERS = 26
NUM_MFCC = 13


# ─── Basic audio processing ───────────────────────────────────────────────────

def apply_noise_gate(audio_data: bytes, threshold: float = 0.02,
                     sample_rate: int = 16000) -> bytes:
    """Apply a simple noise gate to remove low-level background noise."""
    try:
        samples = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32)
        samples = samples / 32768.0  # Normalize to [-1, 1]

        # Apply noise gate
        mask = np.abs(samples) > threshold
        samples = samples * mask

        # Convert back
        samples = (samples * 32768.0).astype(np.int16)
        return samples.tobytes()
    except Exception as e:
        print(f"Noise gate error: {e}")
        return audio_data


def spectral_subtraction(audio_data: bytes, sample_rate: int = 16000,
                          noise_frames: int = 5) -> bytes:
    """Simple spectral subtraction for noise reduction."""
    try:
        samples = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32)
        if len(samples) < 1024:
            return audio_data

        # Estimate noise from first few frames
        frame_size = 512
        noise_estimate = np.zeros(frame_size // 2 + 1)

        for i in range(min(noise_frames, len(samples) // frame_size)):
            frame = samples[i * frame_size:(i + 1) * frame_size]
            if len(frame) == frame_size:
                spec = np.abs(np.fft.rfft(frame * np.hanning(frame_size)))
                noise_estimate += spec
        noise_estimate /= min(noise_frames, len(samples) // frame_size)

        # Process each frame with spectral subtraction
        output = np.zeros_like(samples)
        for i in range(len(samples) // frame_size):
            frame = samples[i * frame_size:(i + 1) * frame_size]
            if len(frame) == frame_size:
                window = np.hanning(frame_size)
                spec = np.fft.rfft(frame * window)
                mag = np.abs(spec)
                phase = np.angle(spec)

                # Subtract noise estimate
                clean_mag = np.maximum(mag - noise_estimate * 1.5, mag * 0.1)
                clean_spec = clean_mag * np.exp(1j * phase)
                clean_frame = np.real(np.fft.irfft(clean_spec))

                output[i * frame_size:(i + 1) * frame_size] = clean_frame

        output = np.clip(output, -32768, 32767).astype(np.int16)
        return output.tobytes()
    except Exception as e:
        print(f"Spectral subtraction error: {e}")
        return audio_data


# ─── Enhanced VAD with multi-feature detection ────────────────────────────────

def compute_zcr(frame: np.ndarray) -> float:
    """Zero-crossing rate — speech has lower ZCR than noise."""
    crossings = np.sum(np.abs(np.diff(np.sign(frame))) > 0)
    return crossings / max(len(frame) - 1, 1)


def compute_spectral_flatness(frame: np.ndarray) -> float:
    """Spectral flatness (Wiener entropy). Speech ≈ 0.0-0.4, noise ≈ 0.5-1.0."""
    spec = np.abs(np.fft.rfft(frame * np.hanning(len(frame))))
    spec = spec[1:]  # skip DC
    spec = np.maximum(spec, 1e-10)
    geometric_mean = np.exp(np.mean(np.log(spec)))
    arithmetic_mean = np.mean(spec)
    return geometric_mean / arithmetic_mean if arithmetic_mean > 0 else 0


def enhanced_vad(audio_data: bytes, sample_rate: int = 16000,
                 frame_duration_ms: int = 30,
                 energy_threshold: float = 50,
                 zcr_threshold: float = 0.35,
                 flatness_threshold: float = 0.5) -> list:
    """Enhanced VAD using energy + zero-crossing rate + spectral flatness.

    This combination distinguishes real human speech from:
    - Background noise (high flatness, high ZCR)
    - Music / TV (different spectral shape)
    - Other environmental sounds

    Returns list of (start_byte, end_byte) tuples for speech segments.
    """
    try:
        samples = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32)
        frame_size = int(sample_rate * frame_duration_ms / 1000)
        num_frames = len(samples) // frame_size

        speech_frames = []
        for i in range(num_frames):
            frame = samples[i * frame_size:(i + 1) * frame_size]
            energy = np.sqrt(np.mean(frame ** 2))
            zcr = compute_zcr(frame)
            flatness = compute_spectral_flatness(frame)

            # Speech must have:
            # 1. Sufficient energy (above ambient)
            # 2. Reasonable ZCR (not unvoiced noise)
            # 3. Low spectral flatness (not white/pink noise)
            if energy > energy_threshold and zcr < zcr_threshold and flatness < flatness_threshold:
                speech_frames.append(i)

        if not speech_frames:
            return []

        # Merge consecutive speech frames into segments (allow 90ms gap)
        segments = []
        start = speech_frames[0]
        prev = speech_frames[0]

        for f in speech_frames[1:]:
            if f - prev > 3:
                segments.append((
                    start * frame_size * 2,
                    (prev + 1) * frame_size * 2
                ))
                start = f
            prev = f

        segments.append((
            start * frame_size * 2,
            (prev + 1) * frame_size * 2
        ))

        return segments
    except Exception as e:
        print(f"Enhanced VAD error: {e}")
        return [(0, len(audio_data))]


def simple_vad(audio_data: bytes, sample_rate: int = 16000,
               frame_duration_ms: int = 30, energy_threshold: float = 50) -> list:
    """Simple energy-based Voice Activity Detection (legacy).

    Returns list of (start_byte, end_byte) tuples for speech segments.
    """
    return enhanced_vad(audio_data, sample_rate, frame_duration_ms, energy_threshold)


# ─── MFCC-based Speaker Verification (server-side) ────────────────────────────

def _hz_to_mel(hz):
    return 2595 * np.log10(1 + hz / 700)


def _mel_to_hz(mel):
    return 700 * (10 ** (mel / 2595) - 1)


def create_mel_filterbank(num_filters: int = NUM_MEL_FILTERS,
                          fft_size: int = FFT_SIZE,
                          sample_rate: int = 16000) -> np.ndarray:
    """Create a mel-scale triangular filterbank."""
    num_bins = fft_size // 2 + 1
    mel_low = _hz_to_mel(80)
    mel_high = _hz_to_mel(sample_rate / 2)
    mel_points = np.linspace(mel_low, mel_high, num_filters + 2)
    hz_points = _mel_to_hz(mel_points)
    bin_points = np.floor((fft_size + 1) * hz_points / sample_rate).astype(int)

    filterbank = np.zeros((num_filters, num_bins))
    for m in range(num_filters):
        left, center, right = bin_points[m], bin_points[m + 1], bin_points[m + 2]
        for k in range(left, min(center + 1, num_bins)):
            if center != left:
                filterbank[m, k] = (k - left) / (center - left)
        for k in range(center, min(right + 1, num_bins)):
            if right != center:
                filterbank[m, k] = (right - k) / (right - center)

    return filterbank


def extract_mfcc(audio_data: bytes, sample_rate: int = 16000,
                 num_mfcc: int = NUM_MFCC) -> np.ndarray:
    """Extract MFCC features from audio bytes. Returns (num_frames, num_mfcc) array."""
    samples = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32)
    samples = samples / 32768.0

    fft_size = FFT_SIZE
    hop = fft_size // 2
    window = np.hanning(fft_size)
    filterbank = create_mel_filterbank(NUM_MEL_FILTERS, fft_size, sample_rate)

    num_frames = max(0, (len(samples) - fft_size) // hop + 1)
    if num_frames == 0:
        return np.array([])

    mfccs = np.zeros((num_frames, num_mfcc))

    for i in range(num_frames):
        start = i * hop
        frame = samples[start:start + fft_size]
        if len(frame) < fft_size:
            frame = np.pad(frame, (0, fft_size - len(frame)))

        # FFT → power spectrum
        spec = np.abs(np.fft.rfft(frame * window)) ** 2

        # Mel filterbank energies
        mel_energies = np.dot(filterbank, spec)
        mel_energies = np.log(np.maximum(mel_energies, 1e-10))

        # DCT → MFCC
        for j in range(num_mfcc):
            mfccs[i, j] = np.sum(
                mel_energies * np.cos(np.pi * j * (np.arange(NUM_MEL_FILTERS) + 0.5) / NUM_MEL_FILTERS)
            )

    return mfccs


class SpeakerVerifier:
    """Server-side speaker verification using MFCC cosine similarity.

    Usage:
        verifier = SpeakerVerifier()
        verifier.enroll(audio_bytes)          # enroll with first speech
        is_match = verifier.verify(audio_bytes)  # verify subsequent audio
    """

    def __init__(self, threshold: float = 0.72):
        self.profile = None       # mean MFCC vector
        self.threshold = threshold
        self.enrolled = False

    def enroll(self, audio_data: bytes, sample_rate: int = 16000) -> bool:
        """Enroll a speaker from audio bytes. Returns True if successful."""
        mfccs = extract_mfcc(audio_data, sample_rate)
        if len(mfccs) < 3:
            return False

        # Filter for speech-energy frames only
        energies = np.sqrt(np.mean(mfccs ** 2, axis=1))
        threshold = np.percentile(energies, 30)
        speech_mask = energies > threshold
        speech_mfccs = mfccs[speech_mask]

        if len(speech_mfccs) < 3:
            return False

        self.profile = np.mean(speech_mfccs, axis=0)
        self.enrolled = True
        return True

    def verify(self, audio_data: bytes, sample_rate: int = 16000) -> dict:
        """Verify if audio matches enrolled speaker.

        Returns dict with 'match' (bool), 'similarity' (float), 'threshold' (float).
        """
        if not self.enrolled or self.profile is None:
            return {'match': True, 'similarity': 1.0, 'threshold': self.threshold}

        mfccs = extract_mfcc(audio_data, sample_rate)
        if len(mfccs) == 0:
            return {'match': False, 'similarity': 0.0, 'threshold': self.threshold}

        mean_mfcc = np.mean(mfccs, axis=0)

        # Cosine similarity
        dot = np.dot(mean_mfcc, self.profile)
        mag_a = np.linalg.norm(mean_mfcc)
        mag_b = np.linalg.norm(self.profile)
        similarity = dot / (mag_a * mag_b) if (mag_a * mag_b) > 0 else 0

        return {
            'match': similarity >= self.threshold,
            'similarity': float(similarity),
            'threshold': self.threshold,
        }

    def reset(self):
        """Reset enrollment."""
        self.profile = None
        self.enrolled = False


# ─── Pipeline ──────────────────────────────────────────────────────────────────

def process_audio_pipeline(audio_data: bytes, sample_rate: int = 16000) -> bytes:
    """Full audio processing pipeline: noise reduction + enhanced VAD filtering."""
    # Step 1: Apply noise gate
    audio_data = apply_noise_gate(audio_data, threshold=0.015)

    # Step 2: Spectral subtraction
    audio_data = spectral_subtraction(audio_data, sample_rate)

    # Step 3: Extract speech segments using enhanced VAD
    segments = enhanced_vad(audio_data, sample_rate)
    if not segments:
        return b''

    # Concatenate speech segments
    speech_audio = b''
    for start, end in segments:
        speech_audio += audio_data[start:end]

    return speech_audio
