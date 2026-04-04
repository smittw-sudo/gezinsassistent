export interface Seizoenstaak {
  naam: string
  tip: string
  intervalDagen: number
}

export function haalSeizoensTaken(): Seizoenstaak[] {
  const maand = new Date().getMonth() + 1 // 1-12

  // Lente: maart, april, mei
  if (maand >= 3 && maand <= 5) return [
    { naam: 'Zomerbanden monteren', tip: 'Wisselen na 7 april als nachtvorst weg is', intervalDagen: 365 },
    { naam: 'Tuin lentebeurt', tip: 'Snoeien, wieden en mest inwerken', intervalDagen: 365 },
    { naam: 'Dakgoot schoonmaken', tip: 'Winterbladeren en mos verwijderen', intervalDagen: 180 },
    { naam: 'BBQ schoonmaken', tip: 'Roosters ontvetten voor het grillseizoen', intervalDagen: 365 },
    { naam: 'Buitenmeubilair ophalen', tip: 'Stoelen en tafel uit opslag of schuur halen', intervalDagen: 365 },
  ]

  // Zomer: juni, juli, augustus
  if (maand >= 6 && maand <= 8) return [
    { naam: 'Ventilator/airco filters reinigen', tip: 'Filters stofvrij maken vóór hittegolf', intervalDagen: 365 },
    { naam: 'Terras en voegen onkruid', tip: 'Voegen schoonmaken tussen tegels en klinkers', intervalDagen: 90 },
    { naam: 'Zonnescherm controleren', tip: 'Mechaniek en doek op scheuren controleren', intervalDagen: 365 },
  ]

  // Herfst: september, oktober, november
  if (maand >= 9 && maand <= 11) return [
    { naam: 'Winterbanden monteren', tip: 'Vóór 1 november wisselen', intervalDagen: 365 },
    { naam: 'Tuin winterklaar maken', tip: 'Planten beschermen, potten binnen, gereedschap opruimen', intervalDagen: 365 },
    { naam: 'CV-ketel jaarservice', tip: 'Monteur inplannen vóór het stookseizoen', intervalDagen: 365 },
    { naam: 'Dakgoot schoonmaken', tip: 'Herfstbladeren verwijderen vóór de vorst', intervalDagen: 180 },
    { naam: 'Buitenmeubilair opbergen', tip: 'Beschermen of naar schuur voor de winter', intervalDagen: 365 },
    { naam: 'Ramen en kozijnen controleren', tip: 'Tochstrips en kitvoegen nakijken', intervalDagen: 365 },
  ]

  // Winter: december, januari, februari
  return [
    { naam: 'Rookmelders testen', tip: 'Batterijen vervangen en werking controleren', intervalDagen: 365 },
    { naam: 'Brandblussers controleren', tip: 'Druk en houdbaarheidsdatum checken', intervalDagen: 730 },
    { naam: 'Winteruitrusting auto checken', tip: 'IJskrabber, antivries, sneeuwkettingen aanwezig?', intervalDagen: 365 },
    { naam: 'Verwarmingsfilters vervangen', tip: 'CV-filters jaarlijks wisselen voor efficiëntie', intervalDagen: 365 },
  ]
}
