export const WORDS: Record<string, string[]> = {
  'Cultura general': ['Pirámide', 'Brújula', 'Volcán', 'Satélite', 'Biblioteca', 'Gladiador', 'Aurora boreal', 'Telescopio', 'Desierto', 'Submarino', 'Dinosaurio', 'Faro'],
  'Comida': ['Paella', 'Croqueta', 'Sushi', 'Tortilla', 'Tacos', 'Pizza', 'Gazpacho', 'Chocolate', 'Hamburguesa', 'Ramen', 'Churros', 'Helado'],
  'Viajes': ['Aeropuerto', 'Maleta', 'Pasaporte', 'Camping', 'Crucero', 'Hostal', 'Mapa', 'Playa', 'Montaña', 'Caravana', 'Tren', 'Mochila'],
  'Cine y series': ['Titanic', 'Matrix', 'Shrek', 'Avatar', 'Friends', 'Stranger Things', 'Gladiator', 'Toy Story', 'Joker', 'Frozen', 'Rocky', 'Casablanca'],
  'Música': ['Guitarra', 'Festival', 'Karaoke', 'Batería', 'Vinilo', 'Concierto', 'Micrófono', 'Piano', 'DJ', 'Orquesta', 'Rap', 'Flamenco'],
  'Deportes': ['Fútbol', 'Baloncesto', 'Fórmula 1', 'MotoGP', 'Tenis', 'Surf', 'Boxeo', 'Ciclismo', 'Maratón', 'Golf', 'Esquí', 'Voleibol'],
  'Videojuegos': ['Minecraft', 'Fortnite', 'Mario Kart', 'Tetris', 'Pokémon', 'Zelda', 'Among Us', 'FIFA', 'Sonic', 'Pac-Man', 'Los Sims', 'Halo'],
  'Fiesta': ['Discoteca', 'Confeti', 'Cóctel', 'Cumpleaños', 'Disfraz', 'Altavoz', 'Fotomatón', 'Champán', 'Baile', 'Globo', 'Pulsera', 'Terraza'],
  'España': ['Madrid', 'Barcelona', 'Sevilla', 'Valencia', 'Galicia', 'Ibiza', 'Alhambra', 'Camino de Santiago', 'Museo del Prado', 'Sagrada Familia', 'Teide', 'Mezquita de Córdoba'],
};

export const CATEGORY_NAMES = Object.keys(WORDS);

export function randomWord(categories: string[], rng: () => number = Math.random): { category: string; word: string } {
  const available = categories.filter((category) => WORDS[category]?.length);
  const category = available[Math.floor(rng() * available.length)] ?? CATEGORY_NAMES[0];
  const words = WORDS[category];
  return { category, word: words[Math.floor(rng() * words.length)] };
}
