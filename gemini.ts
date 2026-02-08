
import type { Vehiculo } from './types';
// Best practice: always use top-level import for GoogleGenAI
import { GoogleGenAI, Type } from "@google/genai";

export type VehiculoData = Partial<Omit<Vehiculo, 'id' | 'año' | 'maintenance_config'> & { año: string }>;
export type GastoData = {
    descripcion?: string;
    monto?: number;
    categoria?: string;
    esFijo?: boolean;
};

export const getGeminiApiKey = (): string | undefined => {
    return localStorage.getItem('gemini_api_key') || (import.meta as any).env?.VITE_GEMINI_API_KEY;
};

export const isGeminiAvailable = (): boolean => {
    return !!getGeminiApiKey();
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
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        throw new Error("No se ha configurado ninguna clave API de Gemini en Ajustes.");
    }

    // Initializing GenAI with API key
    const ai = new GoogleGenAI({ apiKey });

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
    } catch (error: any) {
        console.error("Error al llamar a la API de Gemini:", error);

        if (error.message?.includes("API_KEY_INVALID") || error.message?.includes("not found")) {
            throw new Error("Clave API no válida. Por favor, revísala en la sección de Ajustes.");
        }

        throw new Error("No se pudo analizar la imagen. Inténtelo de nuevo con mejor iluminación o verifique su conexión.");
    }
};

export const recognizeGastoDataFromFile = async (base64Data: string, mimeType: string): Promise<GastoData> => {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        throw new Error("No se ha configurado ninguna clave API de Gemini en Ajustes.");
    }

    const ai = new GoogleGenAI({ apiKey });

    const filePart = {
        inlineData: {
            mimeType: mimeType,
            data: base64Data,
        },
    };

    const textPart = {
        text: `Analiza este comprobante (factura, recibo, ticket) y extrae los datos para un registro de gastos.
        Devuelve un objeto JSON con las siguientes claves:
        - 'descripcion': Una descripción breve y clara del gasto (ej: 'Compra de Repuestos - Filtros', 'Pago de Luz Enero').
        - 'monto': El valor total del gasto como un número (sin símbolos de moneda ni separadores de miles).
        - 'categoria': Debe ser exactamente una de estas: 'Sueldos', 'Alquiler', 'Impuestos', 'Servicios', 'Repuestos', 'Herramientas', 'Marketing', 'Otros'.
        - 'esFijo': Un booleano indicando si parece ser un gasto recurrente o fijo (como alquiler, luz, internet).

        Si no estás seguro de algún campo, usa null. Si el archivo no parece ser un comprobante de gasto, devuelve un objeto vacío.`,
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts: [filePart, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        descripcion: { type: Type.STRING },
                        monto: { type: Type.NUMBER },
                        categoria: { type: Type.STRING },
                        esFijo: { type: Type.BOOLEAN }
                    }
                }
            }
        });

        const jsonString = response.text?.trim();
        if (!jsonString) return {};

        return JSON.parse(jsonString);
    } catch (error: any) {
        console.error("Error al extraer datos de gasto con Gemini:", error);
        throw new Error("No se pudo procesar el archivo. Verifique que sea legible y tenga formato PDF o imagen.");
    }
};

