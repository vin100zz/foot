/* Configuration des compétitions et leurs équipes */

const COMPETITIONS = {
  'english-premier': {
    name: 'Premier League',
    country: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    desc: '8 équipes anglaises',
    teams: [
      {
        id: 'arsenal',
        name: 'Arsenal',
        short: 'ARS',
        kit: { bg: 'linear-gradient(135deg,#ff1d25,#c1121f)' }
      },
      {
        id: 'chelsea',
        name: 'Chelsea',
        short: 'CHE',
        kit: { bg: 'linear-gradient(135deg,#083e8a,#062f66)' }
      },
      {
        id: 'manutd',
        name: 'Man Utd',
        short: 'MUN',
        kit: { bg: 'linear-gradient(135deg,#da291c,#b7181b)' }
      },
      {
        id: 'mancity',
        name: 'Man City',
        short: 'MCI',
        kit: { bg: 'linear-gradient(135deg,#6cabdd,#2d9cdb)' }
      },
      {
        id: 'liverpool',
        name: 'Liverpool',
        short: 'LIV',
        kit: { bg: 'linear-gradient(135deg,#c8102e,#a10b20)' }
      },
      {
        id: 'tottenham',
        name: 'Tottenham',
        short: 'TOT',
        kit: { bg: 'linear-gradient(135deg,#ffffff,#e9eef6)', shadow: 'inset' }
      },
      {
        id: 'newcastle',
        name: 'Newcastle',
        short: 'NEW',
        kit: { bg: 'repeating-linear-gradient(90deg,#000 0 6px,#fff 6px 12px)' }
      },
      {
        id: 'aston',
        name: 'Aston Villa',
        short: 'AVL',
        kit: { bg: 'linear-gradient(135deg,#7a1a3d,#4f0f2b)' }
      }
    ]
  },
  'italian-serie': {
    name: 'Serie A',
    country: '🇮🇹',
    desc: '8 équipes italiennes',
    teams: [
      {
        id: 'juventus',
        name: 'Juventus',
        short: 'JUV',
        kit: { bg: 'repeating-linear-gradient(90deg,#000 0 4px,#fff 4px 8px)' }
      },
      {
        id: 'milan',
        name: 'AC Milan',
        short: 'MIL',
        kit: { bg: 'repeating-linear-gradient(90deg,#c41e3a 0 5px,#000 5px 10px)' }
      },
      {
        id: 'inter',
        name: 'Inter Milan',
        short: 'INT',
        kit: { bg: 'repeating-linear-gradient(90deg,#0066cc 0 5px,#000 5px 10px)' }
      },
      {
        id: 'napoli',
        name: 'Napoli',
        short: 'NAP',
        kit: { bg: 'linear-gradient(135deg,#0066cc,#0052a3)' }
      },
      {
        id: 'roma',
        name: 'AS Roma',
        short: 'ROM',
        kit: { bg: 'linear-gradient(135deg,#d01c1c,#a01818)' }
      },
      {
        id: 'lazio',
        name: 'Lazio',
        short: 'LAZ',
        kit: { bg: 'linear-gradient(135deg,#4299d4,#2672b8)' }
      },
      {
        id: 'atalanta',
        name: 'Atalanta',
        short: 'ATA',
        kit: { bg: 'repeating-linear-gradient(90deg,#1e3a6f 0 4px,#fff 4px 8px)' }
      },
      {
        id: 'fiorentina',
        name: 'Fiorentina',
        short: 'FIO',
        kit: { bg: 'linear-gradient(135deg,#6b2c3e,#4a1a29)' }
      }
    ]
  },
  'spanish-laliga': {
    name: 'La Liga',
    country: '🇪🇸',
    desc: '8 équipes espagnoles',
    teams: [
      {
        id: 'barcelona',
        name: 'Barcelona',
        short: 'BAR',
        kit: { bg: 'repeating-linear-gradient(90deg,#004494 0 4px,#fff 4px 8px)' }
      },
      {
        id: 'madrid',
        name: 'Real Madrid',
        short: 'MAD',
        kit: { bg: 'linear-gradient(135deg,#ffffff,#f0f0f0)', shadow: 'inset' }
      },
      {
        id: 'atletico',
        name: 'Atlético Madrid',
        short: 'ATL',
        kit: { bg: 'repeating-linear-gradient(90deg,#e1050e 0 5px,#fff 5px 10px)' }
      },
      {
        id: 'sevilla',
        name: 'Sevilla',
        short: 'SEV',
        kit: { bg: 'linear-gradient(135deg,#e8102e,#b80824)' }
      },
      {
        id: 'villarreal',
        name: 'Villarreal',
        short: 'VIL',
        kit: { bg: 'linear-gradient(135deg,#ffcc00,#ffd700)' }
      },
      {
        id: 'betis',
        name: 'Real Betis',
        short: 'BET',
        kit: { bg: 'repeating-linear-gradient(90deg,#146c4a 0 5px,#fff 5px 10px)' }
      },
      {
        id: 'sociedad',
        name: 'Real Sociedad',
        short: 'SOC',
        kit: { bg: 'repeating-linear-gradient(90deg,#003366 0 4px,#fff 4px 8px)' }
      },
      {
        id: 'bilbao',
        name: 'Athletic Bilbao',
        short: 'BIL',
        kit: { bg: 'repeating-linear-gradient(90deg,#c60c30 0 5px,#fff 5px 10px)' }
      }
    ]
  },
  'french-ligue1': {
    name: 'Ligue 1',
    country: '🇫🇷',
    desc: '8 équipes françaises',
    teams: [
      {
        id: 'psg',
        name: 'Paris Saint-Germain',
        short: 'PSG',
        kit: { bg: 'linear-gradient(135deg,#004494,#001e50)' }
      },
      {
        id: 'marseille',
        name: 'Olympique Marseille',
        short: 'OM',
        kit: { bg: 'repeating-linear-gradient(90deg,#00519e 0 5px,#fff 5px 10px)' }
      },
      {
        id: 'lyon',
        name: 'Olympique Lyonnais',
        short: 'OL',
        kit: { bg: 'linear-gradient(135deg,#003da5,#001e50)' }
      },
      {
        id: 'lille',
        name: 'LOSC Lille',
        short: 'LIL',
        kit: { bg: 'repeating-linear-gradient(90deg,#e60000 0 4px,#000 4px 8px)' }
      },
      {
        id: 'monaco',
        name: 'AS Monaco',
        short: 'ASM',
        kit: { bg: 'repeating-linear-gradient(90deg,#e10600 0 5px,#fff 5px 10px)' }
      },
      {
        id: 'lens',
        name: 'RC Lens',
        short: 'LEN',
        kit: { bg: 'linear-gradient(135deg,#ffd400,#ffb81c)' }
      },
      {
        id: 'rennes',
        name: 'Stade Rennais',
        short: 'REN',
        kit: { bg: 'repeating-linear-gradient(90deg,#c41e3a 0 5px,#000 5px 10px)' }
      },
      {
        id: 'nantes',
        name: 'FC Nantes',
        short: 'NAN',
        kit: { bg: 'repeating-linear-gradient(90deg,#ffd700 0 4px,#000 4px 8px)' }
      }
    ]
  },
  'german-bundesliga': {
    name: 'Bundesliga',
    country: '🇩🇪',
    desc: '8 équipes allemandes',
    teams: [
      {
        id: 'bayern',
        name: 'FC Bayern Munich',
        short: 'BAY',
        kit: { bg: 'linear-gradient(135deg,#dc052d,#c4001d)' }
      },
      {
        id: 'dortmund',
        name: 'Borussia Dortmund',
        short: 'BVB',
        kit: { bg: 'repeating-linear-gradient(90deg,#ffcc00 0 5px,#000 5px 10px)' }
      },
      {
        id: 'leverkusen',
        name: 'Bayer Leverkusen',
        short: 'LEV',
        kit: { bg: 'repeating-linear-gradient(90deg,#e1000f 0 4px,#000 4px 8px)' }
      },
      {
        id: 'stuttgart',
        name: 'VfB Stuttgart',
        short: 'STU',
        kit: { bg: 'repeating-linear-gradient(90deg,#e1000f 0 4px,#fff 4px 8px)' }
      },
      {
        id: 'frankfurt',
        name: 'Eintracht Frankfurt',
        short: 'SGE',
        kit: { bg: 'repeating-linear-gradient(90deg,#000000 0 4px,#ff0000 4px 8px)' }
      },
      {
        id: 'hoffenheim',
        name: 'TSG Hoffenheim',
        short: 'HOF',
        kit: { bg: 'linear-gradient(135deg,#1e3a8a,#1a2e5f)' }
      },
      {
        id: 'wolfsburg',
        name: 'VfL Wolfsburg',
        short: 'VFL',
        kit: { bg: 'repeating-linear-gradient(90deg,#2d5016 0 5px,#fff 5px 10px)' }
      },
      {
        id: 'freiburg',
        name: 'SC Freiburg',
        short: 'SCF',
        kit: { bg: 'linear-gradient(135deg,#000000,#1a1a1a)' }
      }
    ]
  }
};

// Garder TEAMS_CONFIG pour la compatibilité avec le code existant
const TEAMS_CONFIG = COMPETITIONS['english-premier'].teams;

