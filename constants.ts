export const MAINTENANCE_TYPES = {
    FLUIDS: [
        { key: 'oil', label: 'Aceite de Motor', keywords: ['aceite motor', 'cambio aceite', '5w30', '10w40', '5w40', 'semisintetico', 'sintetico', 'elaion', 'total', 'shell', 'motul'] },
        { key: 'transmission_fluid', label: 'Aceite Transmisión', keywords: ['transmision', 'caja', 'valvulina', 'atf', 'cvt', 'caja manual', 'caja automatica', 'diferencial'] },
        { key: 'coolant', label: 'Refrigerante', keywords: ['refrigerante', 'anticongelante', 'agua radiador', 'coolant', 'paraflu'] },
        { key: 'brake_fluid', label: 'Líquido de Frenos', keywords: ['liquido frenos', 'liquido de freno', 'dot3', 'dot4'] },
    ],
    FILTERS: [
        { key: 'oil_filter', label: 'Filtro Aceite', keywords: ['filtro aceite', 'filtro de aceite'] },
        { key: 'air_filter', label: 'Filtro Aire', keywords: ['filtro aire', 'filtro de aire', 'filtro motor'] },
        { key: 'fuel_filter', label: 'Filtro Combustible', keywords: ['filtro nafta', 'filtro gasoil', 'filtro combustible', 'filtro diesel'] },
        { key: 'cabin_filter', label: 'Filtro Habitáculo', keywords: ['filtro habitaculo', 'filtro polen', 'filtro aire acondicionado'] },
    ],
    OTHERS: [
        { key: 'timing_belt', label: 'Distribución', keywords: ['distribucion', 'correa dentada', 'tensor', 'bomba agua'] },
        { key: 'brakes', label: 'Frenos', keywords: ['pastillas', 'discos', 'frenos', 'cinta de freno', 'rectificacion'] },
        { key: 'spark_plugs', label: 'Bujías', keywords: ['bujias', 'cables de bujia', 'bobina'] },
        { key: 'battery', label: 'Batería', keywords: ['bateria', 'acumulador'] },
        { key: 'tires', label: 'Neumáticos', keywords: ['cubiertas', 'neumaticos', 'alineacion', 'balanceo'] },
    ]
};

export const ALL_MAINTENANCE_OPTS = [
    ...MAINTENANCE_TYPES.FLUIDS,
    ...MAINTENANCE_TYPES.FILTERS,
    ...MAINTENANCE_TYPES.OTHERS
];

// Definición de Temas para la Aplicación
export const APP_THEMES = {
    slate: {
        name: 'Gris Oscuro',
        primary: '51 65 85',    // Slate 700
        secondary: '71 85 105', // Slate 600
        accent: '217 119 6',    // Amber 600
        light: '248 250 252',   // Slate 50
        dark: '15 23 42',       // Slate 900
        gray: '100 116 139',    // Slate 500
    },
    midnight: {
        name: 'Azul Profundo',
        primary: '30 58 138',   // Blue 900
        secondary: '37 99 235', // Blue 600
        accent: '14 165 233',   // Sky 500
        light: '240 249 255',   // Sky 50
        dark: '11 17 32',       // Navy Dark
        gray: '100 116 139',
    },
    crimson: {
        name: 'Rojo Taller',
        primary: '153 27 27',   // Red 800
        secondary: '185 28 28', // Red 700
        accent: '245 158 11',   // Amber 500
        light: '254 242 242',   // Red 50
        dark: '24 9 9',         // Very dark red
        gray: '113 113 122',
    },
    emerald: {
        name: 'Verde Bosque',
        primary: '21 128 61',   // Green 700
        secondary: '22 163 74', // Green 600
        accent: '250 204 21',   // Yellow 400
        light: '240 253 244',   // Green 50
        dark: '6 15 10',        // Very dark green
        gray: '113 113 122',
    },
    amber: {
        name: 'Naranja Óxido',
        primary: '194 65 12',   // Orange 700
        secondary: '217 119 6', // Orange 600
        accent: '30 58 138',    // Contrast with blue
        light: '255 251 235',   // Amber 50
        dark: '20 10 4',        // Very dark orange
        gray: '113 113 122',
    }
};

export const applyAppTheme = (themeName: string) => {
    const theme = APP_THEMES[themeName as keyof typeof APP_THEMES] || APP_THEMES.slate;
    const root = document.documentElement;

    root.style.setProperty('--color-taller-primary', theme.primary);
    root.style.setProperty('--color-taller-secondary', theme.secondary);
    root.style.setProperty('--color-taller-accent', theme.accent);
    root.style.setProperty('--color-taller-light', theme.light);
    root.style.setProperty('--color-taller-dark', theme.dark);
    root.style.setProperty('--color-taller-gray', theme.gray);
};

export const applyFontSize = (size: 'small' | 'normal' | 'large') => {
    const root = document.documentElement;
    switch (size) {
        case 'small':
            root.style.fontSize = '14px';
            break;
        case 'normal':
            root.style.fontSize = '16px';
            break;
        case 'large':
            root.style.fontSize = '18px';
            break;
        default:
            root.style.fontSize = '16px';
    }
};