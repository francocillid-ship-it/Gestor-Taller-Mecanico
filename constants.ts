
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

// Gestiona la clase .dark en el documento basándose en preferencias
export const applyThemeClass = () => {
    const theme = localStorage.getItem('theme') || 'system';
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    if (isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
};

// Aplicar el tema único azul oscuro corporativo (CSS Variables)
export const applyAppTheme = () => {
    const root = document.documentElement;

    // Paleta Azul Marino Profesional
    root.style.setProperty('--color-taller-primary', '30 58 138');   // Blue 900
    root.style.setProperty('--color-taller-secondary', '37 99 235'); // Blue 600
    root.style.setProperty('--color-taller-accent', '245 158 11');    // Amber 500
    root.style.setProperty('--color-taller-light', '240 249 255');   // Sky 50
    root.style.setProperty('--color-taller-dark', '11 17 32');       // Navy Dark
    root.style.setProperty('--color-taller-gray', '100 116 139');    // Slate 500

    // Asegura que la clase dark esté sincronizada
    applyThemeClass();
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
