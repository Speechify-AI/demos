// The languages this demo offers, each paired with a simba-3.0 voice that
// serves that locale (from GET /v1/voices) and a native sample line. simba-3.0
// covers English plus these European languages; the model routes by the voice's
// locale. Spanish is es-MX here because no es-ES voice lists simba-3.0 today.
export interface Language {
  code: string;
  label: string;
  voiceId: string;
  voiceName: string;
  text: string;
}

export const LANGUAGES: Language[] = [
  {
    code: "en-US",
    label: "English (US)",
    voiceId: "alfonso",
    voiceName: "Alfonso",
    text: "Hello, this is a multilingual voiceover demo with Speechify.",
  },
  {
    code: "de-DE",
    label: "German",
    voiceId: "amalia",
    voiceName: "Amalia",
    text: "Hallo, dies ist eine mehrsprachige Sprachausgabe mit Speechify.",
  },
  {
    code: "es-MX",
    label: "Spanish (Mexico)",
    voiceId: "aitana",
    voiceName: "Aitana",
    text: "Hola, esta es una demostración de voz multilingüe con Speechify.",
  },
  {
    code: "fr-FR",
    label: "French",
    voiceId: "adeline",
    voiceName: "Adeline",
    text: "Bonjour, ceci est une démonstration de synthèse vocale multilingue.",
  },
  {
    code: "it-IT",
    label: "Italian",
    voiceId: "alessia",
    voiceName: "Alessia",
    text: "Ciao, questa è una dimostrazione vocale multilingue con Speechify.",
  },
  {
    code: "pt-BR",
    label: "Portuguese (Brazil)",
    voiceId: "adriana",
    voiceName: "Adriana",
    text: "Olá, esta é uma demonstração de voz multilíngue com a Speechify.",
  },
];

export function findLanguage(code: string): Language | undefined {
  return LANGUAGES.find((l) => l.code === code);
}
