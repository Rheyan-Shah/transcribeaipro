export interface GroqTranscriptionResponse {
  text: string;
  segments: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
    avg_logprob?: number;
    compression_ratio?: number;
    no_speech_prob?: number;
  }>;
}

export const transcribeWithGroq = async (fileBlob: Blob | File): Promise<GroqTranscriptionResponse> => {
  const apiKey = localStorage.getItem('groq_api_key');
  if (!apiKey) {
    throw new Error("Groq API Key not found. Please add it in Settings.");
  }

  const formData = new FormData();
  const file = fileBlob instanceof File ? fileBlob : new File([fileBlob], "audio.m4a", { type: "audio/m4a" });
  
  formData.append('file', file);
  formData.append('model', 'whisper-large-v3');
  formData.append('temperature', '0');
  formData.append('response_format', 'verbose_json');
  formData.append('language', 'en');

  try {
    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `Groq API error: ${response.status}`;
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error("CORS/Network Error: Direct browser requests to Groq are sometimes blocked. Ensure the API key and project settings allow client-side access.");
    }
    throw error;
  }
};