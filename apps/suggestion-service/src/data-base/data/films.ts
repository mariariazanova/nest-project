import { DeepPartial } from 'typeorm';
import { FilmEntity } from '../../suggestion/entities/film.entity';

export const films: DeepPartial<FilmEntity>[] = [
  {
    title: 'Incepcja',
    director: 'Christopher Nolan',
    year: 2010,
    moods: [{ name: 'relaxing' }],
    genres: [{ name: 'sci-fi' }],
    events: [{ name: 'discovery' }, { name: 'mystery' }],
    description:
      'Dom Cobb jest złodziejem, który kradnie sekrety z podświadomości ludzi podczas snu. Otrzymuje zadanie wszczepienia idei do umysłu spadkobiercy imperium biznesowego.',
  },
  {
    title: 'Titanic',
    director: 'James Cameron',
    year: 1997,
    moods: [{ name: 'melancholic' }],
    genres: [{ name: 'romance' }],
    events: [{ name: 'love' }, { name: 'disaster' }, { name: 'death' }],
    description:
      'Epicka historia miłości między Jackiem i Rose na pokładzie nieszczęsnego statku Titanic podczas jego dziewiczego rejsu.',
  },
  {
    title: 'The Matrix',
    director: 'Lana Wachowski, Lilly Wachowski',
    year: 1999,
    moods: [{ name: 'relaxing' }],
    genres: [{ name: 'sci-fi' }],
    events: [{ name: 'discovery' }, { name: 'realization' }],
    description:
      'Neo odkrywa, że rzeczywistość, którą zna, to symulacja komputerowa i zostaje wciągnięty w walkę przeciwko maszynom.',
  },
  {
    title: 'Forrest Gump',
    director: 'Robert Zemeckis',
    year: 1994,
    moods: [{ name: 'happy' }, { name: 'melancholic' }],
    genres: [{ name: 'comedy' }, { name: 'drama' }],
    events: [{ name: 'journey' }, { name: 'love' }, { name: 'friendship' }],
    description:
      'Historia życia prostodusznego Forresta Gumpa, który nieświadomie wpływa na najważniejsze wydarzenia w historii USA.',
  },
  {
    title: 'Gladiator',
    director: 'Ridley Scott',
    year: 2000,
    moods: [{ name: 'sad' }, { name: 'dark' }],
    genres: [{ name: 'drama' }],
    events: [{ name: 'revenge' }, { name: 'betrayal' }, { name: 'death' }],
    description:
      'Maximus, generał rzymski, zostaje sprzedany w niewolę jako gladiator po tym, jak cesarz Commodus zamordował jego rodzinę.',
  },
  {
    title: 'Ojciec chrzestny',
    director: 'Francis Ford Coppola',
    year: 1972,
    moods: [{ name: 'dark' }, { name: 'melancholic' }],
    genres: [{ name: 'drama' }, { name: 'crime' }],
    events: [{ name: 'family' }, { name: 'betrayal' }, { name: 'revenge' }],
    description:
      'Saga rodziny Corleone i transformacja Michaela z niechętnego syna w bezwzględnego przywódcę mafii.',
  },
  {
    title: 'Władca Pierścieni: Drużyna Pierścienia',
    director: 'Peter Jackson',
    year: 2001,
    moods: [{ name: 'relaxing' }],
    genres: [{ name: 'fantasy' }],
    events: [{ name: 'journey' }, { name: 'magic' }, { name: 'friendship' }],
    description:
      'Hobbit Frodo wyrusza w niebezpieczną podróż, aby zniszczyć Jedyny Pierścień i pokonać Mrocznego Władcę.',
  },
  {
    title: 'Gwiezdne wojny: Nowa nadzieja',
    director: 'George Lucas',
    year: 1977,
    moods: [{ name: 'melancholic' }],
    genres: [{ name: 'adventure' }],
    events: [{ name: 'journey' }, { name: 'rescue' }, { name: 'discovery' }],
    description:
      'Luke Skywalker dołącza do rebeliantów w walce przeciwko Imperium Galaktycznemu i odkrywa swoje przeznaczenie.',
  },
  {
    title: 'Szeregowiec Ryan',
    director: 'Steven Spielberg',
    year: 1998,
    moods: [{ name: 'sad' }, { name: 'dark' }],
    genres: [{ name: 'drama' }],
    events: [{ name: 'war' }, { name: 'sacrifice' }, { name: 'rescue' }],
    description:
      'Podczas II wojny światowej grupa żołnierzy otrzymuje zadanie odnalezienia i ocalenia szeregowca Ryana.',
  },
  {
    title: 'Avengers: Wojna bez granic',
    director: 'Anthony Russo, Joe Russo',
    year: 2018,
    moods: [{ name: 'relaxing' }],
    genres: [{ name: 'sci-fi' }],
    events: [{ name: 'challenge' }, { name: 'sacrifice' }, { name: 'death' }],
    description:
      'Superbohaterowie łączą siły, aby powstrzymać Thanosa przed zebraniem Kamieni Nieskończoności.',
  },
  {
    title: 'Pulp Fiction',
    director: 'Quentin Tarantino',
    year: 1994,
    moods: [{ name: 'dark' }, { name: 'funny' }],
    genres: [{ name: 'crime' }],
    events: [{ name: 'betrayal' }, { name: 'death' }, { name: 'mystery' }],
    description:
      'Przeplatające się historie gangsterów, bokserów i bandytów w Los Angeles opowiedziane w niechronologicznej kolejności.',
  },
  {
    title: 'Interstellar',
    director: 'Christopher Nolan',
    year: 2014,
    moods: [{ name: 'relaxing' }],
    genres: [{ name: 'sci-fi' }],
    events: [{ name: 'journey' }, { name: 'discovery' }, { name: 'family' }],
    description:
      'Farmer Cooper zostaje astronautą i podróżuje przez tunel czasoprzestrzenny, aby znaleźć nowy dom dla ludzkości.',
  },
  {
    title: 'Ciemny Rycerz',
    director: 'Christopher Nolan',
    year: 2008,
    moods: [{ name: 'dark' }, { name: 'sad' }],
    genres: [{ name: 'crime' }],
    events: [{ name: 'challenge' }, { name: 'betrayal' }, { name: 'sacrifice' }],
    description:
      'Batman zmierza się z Jokerem, który sieje chaos w Gotham City i zmusza go do trudnych wyborów moralnych.',
  },
  {
    title: 'Jurassic Park',
    director: 'Steven Spielberg',
    year: 1993,
    moods: [{ name: 'melancholic' }],
    genres: [{ name: 'adventure' }],
    events: [{ name: 'discovery' }, { name: 'disaster' }, { name: 'rescue' }],
    description:
      'Naukowcy odwiedzają park rozrywki z klonowanymi dinozaurami, ale wszystko idzie nie tak, jak planowano.',
  },
  {
    title: 'Toy Story',
    director: 'John Lasseter',
    year: 1995,
    moods: [{ name: 'happy' }, { name: 'funny' }],
    genres: [{ name: 'comedy' }, { name: 'animation' }],
    events: [{ name: 'friendship' }, { name: 'journey' }, { name: 'rescue' }],
    description:
      'Zabawki ożywają, gdy ludzi nie ma w pobliżu. Kowboj Woody musi zaakceptować nową zabawkę - Buzz Astrala.',
  },
  {
    title: 'Ratatuj',
    director: 'Brad Bird',
    year: 2007,
    moods: [{ name: 'happy' }],
    genres: [{ name: 'animation' }],
    events: [{ name: 'discovery' }, { name: 'friendship' }, { name: 'challenge' }],
    description:
      'Szczur Remy marzy o zostaniu kucharzem i nawiązuje nieoczekiwaną przyjaźń z młodym pracownikiem restauracji.',
  },
  {
    title: 'Coco',
    director: 'Lee Unkrich, Adrian Molina',
    year: 2017,
    moods: [{ name: 'relaxing' }],
    genres: [{ name: 'fantasy' }, { name: 'animation' }],
    events: [{ name: 'family' }, { name: 'discovery' }, { name: 'death' }],
    description:
      'Młody Miguel podróżuje do Krainy Umarłych, aby odkryć prawdę o swojej rodzinie i spełnić swoje muzyczne marzenia.',
  },
  {
    title: 'Piękna i Bestia',
    director: 'Gary Trousdale, Kirk Wise',
    year: 1991,
    moods: [{ name: 'happy' }],
    genres: [{ name: 'animation' }, { name: 'romance' }],
    events: [{ name: 'love' }, { name: 'magic' }, { name: 'realization' }],
    description:
      'Bella zostaje więźniem Bestii w zaczarowanym zamku, ale z czasem odkrywa dobre serce ukryte pod potwórczą postacią.',
  },
  {
    title: 'Szczęki',
    director: 'Steven Spielberg',
    year: 1975,
    moods: [{ name: 'melancholic' }],
    genres: [{ name: 'adventure' }],
    events: [{ name: 'disaster' }, { name: 'challenge' }, { name: 'death' }],
    description:
      'Wielki biały rekin terroryzuje letnie miasteczko, a szeryf, biolog morski i łowca rekinów wyruszają na jego poszukiwanie.',
  },
  {
    title: 'Aladyn',
    director: 'Ron Clements, John Musker',
    year: 1992,
    moods: [{ name: 'relaxing' }],
    genres: [{ name: 'fantasy' }, { name: 'animation' }],
    events: [{ name: 'love' }, { name: 'magic' }, { name: 'discovery' }],
    description:
      'Biedny chłopak Aladyn znajduje magiczną lampę z dżinem i zakochuje się w księżniczce Dżasminie.',
  },
  {
    title: 'Król Lew',
    director: 'Roger Allers, Rob Minkoff',
    year: 1994,
    moods: [{ name: 'happy' }],
    genres: [{ name: 'animation' }],
    events: [{ name: 'family' }, { name: 'betrayal' }, { name: 'journey' }],
    description:
      'Młody lew Simba musi pokonać swojego wuja Skara i zająć swoje miejsce jako król Skały Królewskiej.',
  },
  {
    title: 'Czarownica',
    director: 'Robert Stromberg',
    year: 2014,
    moods: [{ name: 'melancholic' }],
    genres: [{ name: 'adventure' }, { name: 'fantasy' }],
    events: [{ name: 'magic' }, { name: 'betrayal' }, { name: 'revenge' }],
    description:
      'Historia Czarownicy, która rzuca klątwę na księżniczkę Aurore, ale odkrywa, że może być kluczem do pokoju w królestwie.',
  },
  {
    title: 'Harry Potter i Kamień Filozoficzny',
    director: 'Chris Columbus',
    year: 2001,
    moods: [{ name: 'melancholic' }],
    genres: [{ name: 'adventure' }, { name: 'fantasy' }],
    events: [{ name: 'magic' }, { name: 'discovery' }, { name: 'friendship' }],
    description:
      'Harry Potter odkrywa, że jest czarodziejem i rozpoczyna naukę w Hogwarcie, gdzie poznaje swoją prawdziwą historię.',
  },
  {
    title: 'Zjawa',
    director: 'Alejandro G. Iñárritu',
    year: 2015,
    moods: [{ name: 'melancholic' }],
    genres: [{ name: 'adventure' }],
    events: [{ name: 'journey' }, { name: 'revenge' }, { name: 'challenge' }],
    description:
      'Hugh Glass walczy o przetrwanie w dzikiej przyrodzie po brutalnym ataku niedźwiedzia i zdradzie towarzyszy.',
  },
  {
    title: 'Dziewczyna z tatuażem',
    director: 'David Fincher',
    year: 2011,
    moods: [{ name: 'dark' }, { name: 'sad' }],
    genres: [{ name: 'thriller' }],
    events: [{ name: 'mystery' }, { name: 'discovery' }, { name: 'revenge' }],
    description:
      'Dziennikarz Mikael Blomkvist i hacker Lisbeth Salander razem rozwiązują zagadkę zniknięcia młodej kobiety.',
  },
  {
    title: 'Mad Max: Na drodze gniewu',
    director: 'George Miller',
    year: 2015,
    moods: [{ name: 'relaxing' }],
    genres: [{ name: 'sci-fi' }],
    events: [{ name: 'journey' }, { name: 'rescue' }, { name: 'challenge' }],
    description:
      'W postapokaliptycznym świecie Max pomaga Furiose uciec z tyranem Immortanem Joe i jego armią.',
  },
  {
    title: 'La La Land',
    director: 'Damien Chazelle',
    year: 2016,
    moods: [{ name: 'melancholic' }],
    genres: [{ name: 'romance' }],
    events: [{ name: 'love' }, { name: 'realization' }, { name: 'sacrifice' }],
    description:
      'Aspirująca aktorka Mia i jazzowy pianista Sebastian zakochują się w Los Angeles, ale ich marzenia mogą ich rozdzielić.',
  },
  {
    title: 'Nietykalni',
    director: 'Olivier Nakache, Éric Toledano',
    year: 2011,
    moods: [{ name: 'happy' }, { name: 'funny' }],
    genres: [{ name: 'drama' }],
    events: [{ name: 'friendship' }, { name: 'realization' }, { name: 'challenge' }],
    description:
      'Nieoczekiwana przyjaźń między sparaliżowanym arystokratą a jego opiekunem z przedmieścia zmienia życie obydwu.',
  },
  {
    title: 'Django',
    director: 'Quentin Tarantino',
    year: 2012,
    moods: [{ name: 'dark' }, { name: 'sad' }],
    genres: [{ name: 'drama' }],
    events: [{ name: 'revenge' }, { name: 'rescue' }, { name: 'love' }],
    description:
      'Wyzwolony niewolnik Django wyrusza z łowcą nagród, aby uratować swoją żonę z rąk bezwzględnego plantora.',
  },
  {
    title: 'Parasite',
    director: 'Bong Joon-ho',
    year: 2019,
    moods: [{ name: 'dark' }, { name: 'sad' }],
    genres: [{ name: 'thriller' }],
    events: [{ name: 'betrayal' }, { name: 'discovery' }, { name: 'family' }],
    description:
      'Biedna rodzina infiltruje życie bogatej rodziny, ale ich plan prowadzi do nieoczekiwanych konsekwencji.',
  },
  {
    title: 'Dunkierka',
    director: 'Christopher Nolan',
    year: 2017,
    moods: [{ name: 'sad' }, { name: 'dark' }],
    genres: [{ name: 'drama' }],
    events: [{ name: 'war' }, { name: 'rescue' }, { name: 'sacrifice' }],
    description:
      'Aliacka ewakuacja z plaż Dunkierki podczas II wojny światowej opowiedziana z trzech perspektyw czasowych.',
  },
  {
    title: 'The Social Network',
    director: 'David Fincher',
    year: 2010,
    moods: [{ name: 'sad' }, { name: 'dark' }],
    genres: [{ name: 'biography' }],
    events: [{ name: 'betrayal' }, { name: 'discovery' }, { name: 'friendship' }],
    description:
      'Historia powstania Facebooka i złożonych relacji między jego założycielami, szczególnie Markiem Zuckerbergiem.',
  },
  {
    title: 'Cicha noc',
    director: 'Piotr Domalewski',
    year: 2017,
    moods: [{ name: 'sad' }, { name: 'melancholic' }],
    genres: [{ name: 'drama' }],
    events: [{ name: 'family' }, { name: 'death' }, { name: 'holidays' }],
    description:
      'Wigilia Bożego Narodzenia w domu, gdzie rodzina musi zmierzyć się z trudnymi emocjami i niewypowiedzianymi prawdami.',
  },
  {
    title: 'Milczenie owiec',
    director: 'Jonathan Demme',
    year: 1991,
    moods: [{ name: 'dark' }, { name: 'sad' }],
    genres: [{ name: 'thriller' }],
    events: [{ name: 'mystery' }, { name: 'death' }, { name: 'discovery' }],
    description:
      'Agentka FBI Clarice Starling współpracuje z kanibalistycznym psychiatrą Hannibalem Lecterem, aby złapać seryjnego mordercę.',
  },
  {
    title: 'Zakochany bez pamięci',
    director: 'Michel Gondry',
    year: 2004,
    moods: [{ name: 'melancholic' }],
    genres: [{ name: 'romance' }],
    events: [{ name: 'love' }, { name: 'realization' }, { name: 'discovery' }],
    description:
      'Joel i Clementine poddają się procedurze usunięcia wspomnień o swojej nieudanej relacji, ale miłość okazuje się silniejsza.',
  },
  {
    title: 'W pogoni za szczęściem',
    director: 'Gabriele Muccino',
    year: 2006,
    moods: [{ name: 'happy' }, { name: 'romantic' }],
    genres: [{ name: 'biography' }],
    events: [{ name: 'challenge' }, { name: 'family' }, { name: 'realization' }],
    description:
      'Prawdziwa historia Chrisa Gardnera, który z bezdomnego sprzedawcy stał się odnoszącym sukcesy maklerem giełdowym.',
  },
  {
    title: 'Obcy - 8',
    director: 'Ridley Scott',
    year: 1979,
    moods: [{ name: 'relaxing' }],
    genres: [{ name: 'sci-fi' }, { name: 'horror' }],
    events: [{ name: 'discovery' }, { name: 'death' }, { name: 'challenge' }],
    description:
      'Załoga statku kosmicznego Nostromo styka się z śmiertelnie niebezpieczną formą życia pozaziemskiego.',
  },
  {
    title: 'Green Book',
    director: 'Peter Farrelly',
    year: 2018,
    moods: [{ name: 'happy' }],
    genres: [{ name: 'biography' }],
    events: [{ name: 'friendship' }, { name: 'journey' }, { name: 'realization' }],
    description:
      'Kierowca Tony Lip zostaje ochroniarzem czarnoskórego pianisty podczas tournée po amerykańskim Południu w latach 60.',
  },
  {
    title: 'Przeminęło z wiatrem',
    director: 'Victor Fleming',
    year: 1939,
    moods: [{ name: 'melancholic' }],
    genres: [{ name: 'romance' }, { name: 'classic' }],
    events: [{ name: 'love' }, { name: 'war' }, { name: 'family' }],
    description:
      "Saga Scarlett O'Hara podczas wojny secesyjnej i okresu Rekonstrukcji na amerykańskim Południu.",
  },
  {
    title: 'Odyseja kosmiczna 2001',
    director: 'Stanley Kubrick',
    year: 1968,
    moods: [{ name: 'relaxing' }],
    genres: [{ name: 'sci-fi' }],
    events: [{ name: 'discovery' }, { name: 'journey' }, { name: 'mystery' }],
    description:
      'Monumentalna podróż przez czas i przestrzeń, od zarania ludzkości po spotkanie z pozaziemską inteligencją.',
  },
  {
    title: 'Życie jest piękne',
    director: 'Roberto Benigni',
    year: 1997,
    moods: [{ name: 'sad' }, { name: 'funny' }],
    genres: [{ name: 'comedy' }],
    events: [{ name: 'war' }, { name: 'family' }, { name: 'sacrifice' }],
    description:
      'Żydowski ojciec używa wyobraźni i humoru, aby chronić syna przed okropnościami obozu koncentracyjnego.',
  },
  {
    title: 'Gwiezdne wojny: Imperium kontratakuje',
    director: 'Irvin Kershner',
    year: 1980,
    moods: [{ name: 'melancholic' }],
    genres: [{ name: 'adventure' }],
    events: [{ name: 'betrayal' }, { name: 'discovery' }, { name: 'family' }],
    description:
      'Imperium Galaktyczne kontratakuje, a Luke Skywalker odkrywa szokującą prawdę o swoim pochodzeniu.',
  },
  {
    title: 'Piękny umysł',
    director: 'Ron Howard',
    year: 2001,
    moods: [{ name: 'sad' }, { name: 'romantic' }],
    genres: [{ name: 'biography' }],
    events: [{ name: 'challenge' }, { name: 'love' }, { name: 'realization' }],
    description:
      'Historia genialnego matematyka Johna Nasha, który zmaga się z schizofrenią przy wsparciu kochającej żony.',
  },
  {
    title: 'Wall-E',
    director: 'Andrew Stanton',
    year: 2008,
    moods: [{ name: 'happy' }],
    genres: [{ name: 'animation' }],
    events: [{ name: 'love' }, { name: 'discovery' }, { name: 'journey' }],
    description:
      'Robot sprzątający Wall-E zakochuje się w robocie EVE i wyrusza w kosmiczną przygodę, aby ocalić ludzkość.',
  },
  {
    title: 'Bohemian Rhapsody',
    director: 'Bryan Singer',
    year: 2018,
    moods: [{ name: 'happy' }, { name: 'romantic' }],
    genres: [{ name: 'biography' }],
    events: [{ name: 'discovery' }, { name: 'realization' }, { name: 'challenge' }],
    description:
      "Biografia Freddiego Mercury'ego i zespołu Queen, od początków do legendarnego występu na Live Aid.",
  },
  {
    title: 'The Big Lebowski',
    director: 'Joel Coen',
    year: 1998,
    moods: [{ name: 'funny' }],
    genres: [{ name: 'comedy' }],
    events: [{ name: 'mystery' }, { name: 'friendship' }, { name: 'betrayal' }],
    description:
      'Dude, luźny typ z Los Angeles, zostaje wciągnięty w absurdalną intrygę związaną z pomyłką tożsamości.',
  },
  {
    title: 'Rocky',
    director: 'John G. Avildsen',
    year: 1976,
    moods: [{ name: 'happy' }, { name: 'romantic' }],
    genres: [{ name: 'drama' }],
    events: [{ name: 'challenge' }, { name: 'love' }, { name: 'realization' }],
    description:
      'Małej klasy bokser Rocky Balboa dostaje szansę swojego życia - walkę z mistrzem świata Apollo Creedem.',
  },
  {
    title: 'Władca Pierścieni: Powrót króla',
    director: 'Peter Jackson',
    year: 2003,
    moods: [{ name: 'melancholic' }],
    genres: [{ name: 'adventure' }, { name: 'fantasy' }],
    events: [{ name: 'sacrifice' }, { name: 'reunion' }, { name: 'death' }],
    description:
      'Finał epickiej sagii, w którym Frodo i Sam docierają do Góry Przeznaczenia, a Aragorn zostaje królem Gondoru.',
  },
  {
    title: 'Skazani na Shawshank',
    director: 'Frank Darabont',
    year: 1994,
    moods: [{ name: 'sad' }, { name: 'dark' }],
    genres: [{ name: 'crime' }],
    events: [{ name: 'friendship' }, { name: 'betrayal' }, { name: 'discovery' }],
    description:
      'Andy Dufresne, niesłusznie skazany na dożywocie, nawiązuje przyjaźń z Redem i planuje ucieczkę z więzienia.',
  },
  {
    title: 'Casablanca',
    director: 'Michael Curtiz',
    year: 1942,
    moods: [{ name: 'melancholic' }],
    genres: [{ name: 'romance' }, { name: 'classic' }],
    events: [{ name: 'love' }, { name: 'sacrifice' }, { name: 'war' }],
    description:
      'W okupowanej Casablance Rick Blaine musi wybrać między miłością a honorem, gdy jego dawna ukochana przybywa z mężem.',
  },
  {
    title: 'Egzorcysta',
    director: 'William Friedkin',
    year: 1973,
    moods: [{ name: 'dark' }, { name: 'melancholic' }],
    genres: [{ name: 'horror' }],
    events: [{ name: 'challenge' }, { name: 'death' }, { name: 'sacrifice' }],
    description:
      'Matka desperacko szuka pomocy dla swojej opętanej córki, zwracając się do dwóch księży o przeprowadzenie egzorcyzmu.',
  },
  {
    title: 'Lśnienie',
    director: 'Stanley Kubrick',
    year: 1980,
    moods: [{ name: 'dark' }, { name: 'melancholic' }],
    genres: [{ name: 'horror' }],
    events: [{ name: 'family' }, { name: 'death' }, { name: 'betrayal' }],
    description:
      'Jack Torrance zostaje dozorcą odizolowanego hotelu na zimę, gdzie stopniowo popada w szaleństwo.',
  },
  {
    title: 'Koszmar z ulicy Wiązów',
    director: 'Wes Craven',
    year: 1984,
    moods: [{ name: 'dark' }, { name: 'sad' }],
    genres: [{ name: 'horror' }],
    events: [{ name: 'death' }, { name: 'mystery' }, { name: 'challenge' }],
    description:
      'Freddy Krueger, morderczy duch, poluje na nastolatków w ich snach, zabijając ich w rzeczywistości.',
  },
  {
    title: 'Halloween',
    director: 'John Carpenter',
    year: 1978,
    moods: [{ name: 'dark' }, { name: 'sad' }],
    genres: [{ name: 'horror' }],
    events: [{ name: 'death' }, { name: 'mystery' }, { name: 'challenge' }],
    description:
      'Michael Myers ucieka z zakładu psychiatrycznego i wraca do swojego rodzinnego miasta, aby kontynuować swoją mordercze dzieło.',
  },
  {
    title: 'Obcy - ósmy pasażer Nostromo',
    director: 'Ridley Scott',
    year: 1979,
    moods: [{ name: 'dark' }, { name: 'sad' }],
    genres: [{ name: 'horror' }, { name: 'sci-fi' }],
    events: [{ name: 'discovery' }, { name: 'death' }, { name: 'challenge' }],
    description:
      'Załoga statku kosmicznego styka się z agresywną formą życia pozaziemskiego, która systematycznie ich eliminuje.',
  },
  {
    title: 'Psychoza',
    director: 'Alfred Hitchcock',
    year: 1960,
    moods: [{ name: 'dark' }, { name: 'melancholic' }],
    genres: [{ name: 'horror' }],
    events: [{ name: 'mystery' }, { name: 'death' }, { name: 'betrayal' }],
    description:
      'Marion Crane zatrzymuje się w odludnym motelu prowadzonym przez zagadkowego Normana Batesa i jego dominującą matkę.',
  },
  {
    title: 'The Blair Witch Project',
    director: 'Daniel Myrick, Eduardo Sánchez',
    year: 1999,
    moods: [{ name: 'dark' }, { name: 'sad' }],
    genres: [{ name: 'horror' }],
    events: [{ name: 'mystery' }, { name: 'death' }, { name: 'discovery' }],
    description:
      'Trzech studentów filmowych gubi się w lesach Maryland podczas kręcenia dokumentu o lokalnej legendzie czarownicy.',
  },
  {
    title: 'Dziecko Rosemary',
    director: 'Roman Polański',
    year: 1968,
    moods: [{ name: 'dark' }, { name: 'sad' }],
    genres: [{ name: 'horror' }],
    events: [{ name: 'betrayal' }, { name: 'family' }, { name: 'mystery' }],
    description:
      'Młoda kobieta zaczyna podejrzewać, że jej sąsiedzi należą do sekty szatanistycznej i mają złowrogie plany względem jej dziecka.',
  },
  {
    title: 'The Ring',
    director: 'Gore Verbinski',
    year: 2002,
    moods: [{ name: 'dark' }, { name: 'sad' }],
    genres: [{ name: 'horror' }],
    events: [{ name: 'mystery' }, { name: 'death' }, { name: 'discovery' }],
    description:
      'Dziennikarka Rachel badaje tajemniczą kasetę wideo, która zabija każdego, kto ją obejrzy, dokładnie siedem dni później.',
  },
  {
    title: 'Piła',
    director: 'James Wan',
    year: 2004,
    moods: [{ name: 'dark' }, { name: 'sad' }],
    genres: [{ name: 'horror' }],
    events: [{ name: 'challenge' }, { name: 'death' }, { name: 'mystery' }],
    description:
      'Dwóch mężczyzn budzi się przykutych w brudnej łazience i musi uczestniczyć w śmiertelnej grze wymyślonej przez Jigsaw.',
  },
  {
    title: 'Fahrenheit 9/11',
    director: 'Michael Moore',
    year: 2004,
    moods: [{ name: 'dark' }, { name: 'sad' }],
    genres: [{ name: 'documentary' }],
    events: [{ name: 'war' }, { name: 'betrayal' }, { name: 'discovery' }],
    description:
      'Michael Moore bada związki między rodziną Bush a rodziną bin Ladenów oraz politykę amerykańską po 11 września.',
  },
  {
    title: 'Człowiek na linie',
    director: 'James Marsh',
    year: 2008,
    moods: [{ name: 'romantic' }, { name: 'happy' }],
    genres: [{ name: 'documentary' }],
    events: [{ name: 'challenge' }, { name: 'discovery' }, { name: 'realization' }],
    description:
      'Historia Philippe Petit, który nielegalnie przeszedł po linie między wieżami World Trade Center w 1974 roku.',
  },
  {
    title: 'Ziemia',
    director: 'Alastair Fothergill, Mark Linfield',
    year: 2007,
    moods: [{ name: 'romantic' }, { name: 'sad' }],
    genres: [{ name: 'documentary' }],
    events: [{ name: 'journey' }, { name: 'family' }, { name: 'challenge' }],
    description:
      'Spektakularny dokument przyrodniczy pokazujący migracje zwierząt i ich walkę o przetrwanie na różnych kontynentach.',
  },
  {
    title: 'Supersize Me',
    director: 'Morgan Spurlock',
    year: 2004,
    moods: [{ name: 'sad' }, { name: 'funny' }],
    genres: [{ name: 'documentary' }],
    events: [{ name: 'challenge' }, { name: 'discovery' }, { name: 'realization' }],
    description:
      "Morgan Spurlock przez miesiąc żywi się wyłącznie jedzeniem z McDonald's, dokumentując wpływ na swoje zdrowie.",
  },
  {
    title: 'Czarnobyl. Rekwiem dla świata',
    director: 'Lucy Walker',
    year: 2021,
    moods: [{ name: 'dark' }, { name: 'sad' }],
    genres: [{ name: 'documentary' }],
    events: [{ name: 'disaster' }, { name: 'death' }, { name: 'sacrifice' }],
    description:
      'Dokument o katastrofie nuklearnej w Czarnobylu i jej długotrwałych skutkach dla ludzi i środowiska.',
  },
  {
    title: 'Jiro śni o sushi',
    director: 'David Gelb',
    year: 2011,
    moods: [{ name: 'happy' }, { name: 'romantic' }],
    genres: [{ name: 'documentary' }],
    events: [{ name: 'family' }, { name: 'realization' }, { name: 'challenge' }],
    description:
      'Portret 85-letniego mistrza sushi Jiro Ono i jego dążenia do perfekcji w swojej małej restauracji w Tokio.',
  },
  {
    title: 'The Act of Killing',
    director: 'Joshua Oppenheimer',
    year: 2012,
    moods: [{ name: 'dark' }, { name: 'sad' }],
    genres: [{ name: 'documentary' }],
    events: [{ name: 'death' }, { name: 'realization' }, { name: 'betrayal' }],
    description:
      'Szokujący dokument, w którym indonezyjscy mordercy masowi odtwarzają swoje zbrodnie z lat 60.',
  },
  {
    title: 'March of the Penguins',
    director: 'Luc Jacquet',
    year: 2005,
    moods: [{ name: 'happy' }, { name: 'romantic' }],
    genres: [{ name: 'documentary' }],
    events: [{ name: 'journey' }, { name: 'family' }, { name: 'love' }],
    description:
      'Dokument o niezwykłej podróży pingwinów cesarskich w Antarktyce podczas sezonu godowego.',
  },
  {
    title: 'The Cove',
    director: 'Louie Psihoyos',
    year: 2009,
    moods: [{ name: 'dark' }, { name: 'sad' }],
    genres: [{ name: 'documentary' }],
    events: [{ name: 'discovery' }, { name: 'death' }, { name: 'betrayal' }],
    description:
      "Aktywista Ric O'Barry ujawnia tajemne polowania na delfiny w japońskiej zatoce Taiji.",
  },
  {
    title: '13th',
    director: 'Ava DuVernay',
    year: 2016,
    moods: [{ name: 'dark' }, { name: 'sad' }],
    genres: [{ name: 'documentary' }],
    events: [{ name: 'betrayal' }, { name: 'discovery' }, { name: 'realization' }],
    description:
      'Analiza amerykańskiego systemu więziennictwa i jego powiązań z historią niewolnictwa i dyskryminacji rasowej.',
  },
];

export default films;
