
import type { Vehiculo } from './types';

export type VehiculoData = Partial<Omit<Vehiculo, 'id' | 'año' | 'maintenance_config'> & { año: string }>;

export const isGeminiAvailable = (): boolean => {
    return !!process.env.API_KEY;
};

const calculateYearFromPatente = (patente: string): string | null => {
    const cleanPatente = patente.replace(/\s/g, '').toUpperCase();
    
    const oldFormatRegex = /^[A-Z]{3}\d{3}$/;
    const mercosurFormatRegex = /^[A-Z]{2}\d{3}[A-Z]{2}$/;

    if (oldFormatRegex.test(cleanPatente)) {
        const firstLetter = cleanPatente[0];
        let year: number | null = null;
        
        switch (firstLetter) {
            case 'A': year = 1996; break;
            case 'B': year = 1998; break;
            case 'C': year = 2000; break;
            case 'D': year = 2002; break;
            case 'E': year = 2004; break;
            case 'F': year = 2006; break;
            case 'G': year = 2007; break;
            case 'H': year = 2008; break;
            case 'I': year = 2009; break;
            case 'J': year = 2010; break;
            case 'K': year = 2011; break;
            case 'L': year = 2012; break;
            case 'M': year = 2013; break;
            case 'N': year = 2014; break;
            case 'O': year = 2015; break;
            case 'P': year = 2015; break; 
            default: year = null;
        }
        
        if (year) {
            return String(year);
        }

    } else if (mercosurFormatRegex.test(cleanPatente)) {
        const secondLetter = cleanPatente[1];
        const year = 2016 + (secondLetter.charCodeAt(0) - 'A'.charCodeAt(0));
        const currentYear = new Date().getFullYear();
        if (year >= 2016 && year <= currentYear + 1) { 
            return String(year);
        }
    }
    
    return null;
};


export const recognizeVehicleDataFromImage = async (base64Image: string): Promise<VehiculoData> => {
    // Dynamic import of GenAI SDK
    const { GoogleGenAI, Type } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const imagePart = {
        inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image,
        },
    };

    const textPart = {
        text: `Eres un sistema experto en leer la 'Cédula de Identificación del Automotor' de Argentina (cédula verde). Analiza la imagen y extrae los campos 'Marca', 'Modelo', 'Año Modelo', 'Dominio', 'Nro. de Chasis', y 'Nro. de Motor'. Devuelve un objeto JSON con las claves 'marca', 'modelo', 'año', 'matricula', 'numero_chasis', y 'numero_motor'. Los campos de texto deben estar siempre en MAYÚSCULAS. Si no estás completamente seguro de un valor, déjalo como null. Si no puedes identificar el documento o no encuentras al menos 3 campos con alta confianza, devuelve un objeto JSON vacío.`,
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        marca: { type: Type.STRING },
                        modelo: { type: Type.STRING },
                        año: { type: Type.STRING },
                        matricula: { type: Type.STRING },
                        numero_chasis: { type: Type.STRING },
                        numero_motor: { type: Type.STRING }
                    },
                }
            }
        });

        const jsonString = response.text?.trim();
        if (!jsonString) return {};
        
        const parsedData = JSON.parse(jsonString);
        
        const cleanData: VehiculoData = {};
        for (const key in parsedData) {
            if (parsedData[key] !== null && parsedData[key] !== undefined) {
                if (['marca', 'modelo', 'matricula', 'numero_chasis', 'numero_motor'].includes(key)) {
                    cleanData[key as keyof VehiculoData] = String(parsedData[key]).toUpperCase();
                } else {
                    cleanData[key as keyof VehiculoData] = String(parsedData[key]);
                }
            }
        }

        if (Object.keys(cleanData).length < 3) {
            return {};
        }

        if (cleanData.matricula) {
            const calculatedYear = calculateYearFromPatente(cleanData.matricula);
            if (calculatedYear) {
                cleanData.año = calculatedYear;
            }
        }

        return cleanData;
    } catch (error) {
        console.error("Error al llamar a la API de Gemini:", error);
        throw new Error("No se pudo analizar la imagen. Inténtelo de nuevo con mejor iluminación.");
    }
};
