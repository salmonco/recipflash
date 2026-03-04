import { Platform } from 'react-native';

const FIREBASE_PROJECT_ID = 'recipflash';
const FIREBASE_API_KEY = Platform.select({
  ios: 'AIzaSyBOGD9JPsIdmx8IcLI-b7CJiNo7rKjsai8',
  android: 'AIzaSyCnxCqysu7ACs02SxgRySHSKK0dfqy7ZuY',
})!;

const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

interface SurveyResponse {
  userId: string | null;
  q1_disappointment: string;
  q2_useful_features: string[];
  q3_alternative: string;
  q4_improvement: string;
  createdAt: string;
  platform: string;
  appVersion: string;
}

function toFirestoreValue(value: unknown): Record<string, unknown> {
  if (value === null) {
    return { nullValue: null };
  }
  if (typeof value === 'string') {
    return { stringValue: value };
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map(item => toFirestoreValue(item)),
      },
    };
  }
  return { stringValue: String(value) };
}

function toFirestoreDocument(data: Record<string, unknown>) {
  const fields: Record<string, Record<string, unknown>> = {};
  for (const [key, value] of Object.entries(data)) {
    fields[key] = toFirestoreValue(value);
  }
  return { fields };
}

export async function submitSurveyResponse(
  data: SurveyResponse,
): Promise<{ success: boolean; error?: string }> {
  try {
    const url = `${FIRESTORE_BASE_URL}/survey_responses?key=${FIREBASE_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        toFirestoreDocument(data as unknown as Record<string, unknown>),
      ),
    });
    if (!response.ok) {
      const errorBody = await response.text();
      return { success: false, error: `${response.status}: ${errorBody}` };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Network error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
