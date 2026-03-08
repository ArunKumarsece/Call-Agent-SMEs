"""Audio processing utilities — VAD and noise suppression."""

import numpy as np
import struct
import io


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
        from scipy import signal

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


def simple_vad(audio_data: bytes, sample_rate: int = 16000,
               frame_duration_ms: int = 30, energy_threshold: float = 50) -> list:
    """Simple energy-based Voice Activity Detection.

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
            if energy > energy_threshold:
                speech_frames.append(i)

        if not speech_frames:
            return []

        # Merge consecutive speech frames into segments
        segments = []
        start = speech_frames[0]
        prev = speech_frames[0]

        for f in speech_frames[1:]:
            if f - prev > 3:  # Allow gap of 3 frames (~90ms)
                segments.append((
                    start * frame_size * 2,  # *2 for int16 byte offset
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
        print(f"VAD error: {e}")
        return [(0, len(audio_data))]


def process_audio_pipeline(audio_data: bytes, sample_rate: int = 16000) -> bytes:
    """Full audio processing pipeline: noise reduction + VAD filtering."""
    # Step 1: Apply noise gate
    audio_data = apply_noise_gate(audio_data, threshold=0.015)

    # Step 2: Spectral subtraction
    audio_data = spectral_subtraction(audio_data, sample_rate)

    # Step 3: Extract speech segments using VAD
    segments = simple_vad(audio_data, sample_rate)
    if not segments:
        return b''

    # Concatenate speech segments
    speech_audio = b''
    for start, end in segments:
        speech_audio += audio_data[start:end]

    return speech_audio
