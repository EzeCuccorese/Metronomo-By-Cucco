export const INSTRUMENT_IMAGES: Record<string, string> = {
    bombo_leguero: '/instruments/bombo_leguero.webp',
    bombo: '/instruments/bombo_leguero.webp',
    caja: '/instruments/tom.webp',
    cajon: '/instruments/tom.webp',
    palmas: '/instruments/claves.webp',
    candombe_chico: '/instruments/tom.webp',
    candombe_repique: '/instruments/tom.webp',
    candombe_piano: '/instruments/tom.webp',
    surdo: '/instruments/kick.webp',
    rim: '/instruments/bombo_leguero.webp',
    clave: '/instruments/claves.webp',
    shaker: '/instruments/shaker.webp',
    kick: '/instruments/kick.webp',
    snare: '/instruments/snare.webp',
    hihat: '/instruments/hihat.webp',
    hihat_foot: '/instruments/hihat.webp',
    ride: '/instruments/hihat.webp',
    crash: '/instruments/hihat.webp',
    tom_high: '/instruments/tom.webp',
    tom_low: '/instruments/tom.webp',
    tom_floor: '/instruments/tom.webp',
    click: '/instruments/click.webp',
    synth: '/instruments/keyboard.webp'
};

export const getInstrumentImage = (type: string): string => {
    return INSTRUMENT_IMAGES[type] || '/instruments/click.webp';
};
