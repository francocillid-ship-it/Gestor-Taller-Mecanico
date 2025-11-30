import { GoogleGenAI, Part, Type } from "@google/genai";
import type { Vehiculo } from './types';

const getGeminiClient = (): GoogleGenAI | null => {
    const apiKey = localStorage.getItem('gemini_api_key');
    if (apiKey) {
        return new GoogleGenAI({ apiKey });
    }
    return null;
};

export type VehiculoData = Partial<Omit<Vehiculo, 'id' | 'año' | 'maintenance_config'> & { año: string }>;

export const isGeminiAvailable = (): boolean => {
    return !!localStorage.getItem('gemini_api_key');
};

const calculateYearFromPatente = (patente: string): string | null => {
    const cleanPatente = patente.replace(/\s/g, '').toUpperCase();
    
    // Formato antiguo: LLLNNN (e.g., ABC123)
    const oldFormatRegex = /^[A-Z]{3}\d{3}$/;
    // Formato Mercosur: LLNNNLL (e.g., AB123CD)
    const mercosurFormatRegex = /^[A-Z]{2}\d{3}[A-Z]{2}$/;

    if (oldFormatRegex.test(cleanPatente)) {
        const firstLetter = cleanPatente[0];
        let year: number | null = null;
        
        switch (firstLetter) {
            case 'A': year = 1996; break; // 95/96
            case 'B': year = 1998; break; // 97/98
            case 'C': year = 2000; break; // 99/00
            case 'D': year = 2002; break; // 01/02
            case 'E': year = 2004; break; // 03/04
            case 'F': year = 2006; break; // 05/06
            case 'G': year = 2007; break;
            case 'H': year = 2008; break;
            case 'I': year = 2009; break;
            case 'J': year = 2010; break;
            case 'K': year = 2011; break;
            case 'L': year = 2012; break;
            case 'M': year = 2013; break;
            case 'N': year = 2014; break;
            case 'O': year = 2015; break;
            case 'P': year = 2015; break; // G-P se acomodan entre 07 y 15
            default: year = null;
        }
        
        if (year) {
            return String(year);
        }

    } else if (mercosurFormatRegex.test(cleanPatente)) {
        const secondLetter = cleanPatente[1];
        // A=2016, B=2017, etc.
        const year = 2016 + (secondLetter.charCodeAt(0) - 'A'.charCodeAt(0));
        const currentYear = new Date().getFullYear();
        if (year >= 2016 && year <= currentYear + 1) { // Cap at next year
            return String(year);
        }
    }
    
    return null;
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