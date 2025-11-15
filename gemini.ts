import { GoogleGenAI, Part, Type } from "@google/genai";
import type { Vehiculo } from './types';

const getGeminiClient = (): GoogleGenAI | null => {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (apiKey) {
        return new GoogleGenAI({ apiKey });
    }
    return null;
};

export type VehiculoData = Partial<Omit<Vehiculo, 'id' | 'año'> & { año: string }>;

export const isGeminiAvailable = (): boolean => {
    return !!localStorage.getItem('gemini_api_key');
};

export const recognizeVehicleDataFromImage = async (base64Image: string): Promise<VehiculoData> => {
    const ai = getGeminiClient();
    if (!ai) {
        throw new Error("La API Key de Gemini no está configurada. Por favor, ingrésela en Ajustes.");
    }

    const imagePart: Part = {
        inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image,
        },
    };

    const textPart: Part = {
        text: `Eres un sistema experto en leer la 'Cédula de Identificación del Automotor' de Argentina (cédula verde). Analiza la imagen y extrae los campos 'Marca', 'Modelo', 'Año Modelo', 'Dominio', 'Nro. de Chasis', y 'Nro. de Motor'. Devuelve un objeto JSON con las claves 'marca', 'modelo', 'año', 'matricula', 'numero_chasis', y 'numero_motor'. Si no estás completamente seguro de un valor, déjalo como null. Si no puedes identificar el documento o no encuentras al menos 3 campos con alta confianza, devuelve un objeto JSON vacío.`,
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        marca: { type: Type.STRING, nullable: true },
                        modelo: { type: Type.STRING, nullable: true },
                        año: { type: Type.STRING, nullable: true },
                        matricula: { type: Type.STRING, nullable: true },
                        numero_chasis: { type: Type.STRING, nullable: true },
                        numero_motor: { type: Type.STRING, nullable: true }
                    },
                }
            }
        });

        const jsonString = response.text.trim();
        const parsedData = JSON.parse(jsonString);
        
        const cleanData: VehiculoData = {};
        for (const key in parsedData) {
            if (parsedData[key] !== null && parsedData[key] !== undefined) {
                cleanData[key as keyof VehiculoData] = String(parsedData[key]);
            }
        }

        if (Object.keys(cleanData).length < 3) {
            return {};
        }

        return cleanData;
    } catch (error) {
        console.error("Error al llamar a la API de Gemini:", error);
        throw new Error("No se pudo analizar la imagen. Inténtelo de nuevo con mejor iluminación.");
    }
};
