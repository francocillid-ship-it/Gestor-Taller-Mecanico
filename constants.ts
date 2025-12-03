
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
// Los valores son RGB para usar en las variables CSS
export const APP_THEMES = {
    slate: {
        name: 'Slate (Clásico)',
        primary: '51 65 85',    // Slate 700
        secondary: '71 85 105', // Slate 600
        accent: '217 119 6',    // Amber 600
        light: '248 250 252',   // Slate 50
        dark: '15 23 42',       // Slate 900
        gray: '100 116 139',    // Slate 500
    },
    zinc: {
        name: 'Zinc (Neutro)',
        primary: '63 63 70',    // Zinc 700
        secondary: '82 82 91',  // Zinc 600
        accent: '22 163 74',    // Green 600 (Toque sutil)
        light: '250 250 250',   // Zinc 50
        dark: '24 24 27',       // Zinc 900
        gray: '113 113 122',    // Zinc 500
    },
    stone: {
        name: 'Stone (Cálido)',
        primary: '68 64 60',    // Stone 700
        secondary: '87 83 78',  // Stone 600
        accent: '234 88 12',    // Orange 600
        light: '250 250 249',   // Stone 50
        dark: '28 25 23',       // Stone 900
        gray: '120 113 108',    // Stone 500
    },
    midnight: {
        name: 'Midnight (Azul Profundo)',
        primary: '30 58 138',   // Blue 900 (Desaturado oscuro)
        secondary: '30 64 175', // Blue 800
        accent: '14 165 233',   // Sky 500
        light: '240 249 255',   // Sky 50
        dark: '11 17 32',       // Custom Dark Navy
        gray: '100 116 139',    // Slate 500
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
    // Default base size is 16px (100%). We scale from there.
    // Tailwind uses rems, so changing root font-size scales the entire UI.
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
