const masterCityData: Record<string, any[]> = {
  "Austin, TX": [
    // ── Plumbing ──────────────────────────────────────────────────────────────
    { name: "Radiant Plumbing, Air Conditioning, & Electrical", website: "https://radiantplumbing.com/austin/", phone: "(512) 690-4935", rating: 4.8, reviews: 16435, category: "Plumbing", status: "Needs AI Chatbot" },
    { name: "Beyond Wow Plumbing & Drains", website: "https://beyondwow.com/", phone: "(512) 601-6173", rating: 4.8, reviews: 2296, category: "Plumbing", status: "Needs AI Chatbot" },
    { name: "BenjaminBL Plumbing", website: "https://www.benjaminblplumbing.com/", phone: "(512) 265-5642", rating: 4.9, reviews: 288, category: "Plumbing", status: "Needs AI Chatbot" },
    { name: "Austin Plumbing Experts", website: null, phone: "(512) 938-5056", rating: 5.0, reviews: 17, category: "Plumbing", status: "No Website" },
    { name: "L & P Plumbing, LLC", website: "https://www.lnpplumbing.com/", phone: "(512) 468-9030", rating: 4.8, reviews: 163, category: "Plumbing", status: "Needs AI Chatbot" },
    { name: "Abacus Plumbing, Air Conditioning & Electrical", website: "https://www.abacusplumbing.com/austin/", phone: "(512) 309-1487", rating: 4.7, reviews: 112, category: "Plumbing", status: "Needs AI Chatbot" },
    { name: "Moore & More Plumbing, LLC.", website: "http://www.mooremoreplumbing.com/", phone: "(512) 445-5212", rating: 4.8, reviews: 264, category: "Plumbing", status: "Old Website" },
    { name: "Clarke Kent Plumbing", website: "https://www.clarkekentplumbing.com/", phone: "(512) 477-2200", rating: 4.5, reviews: 564, category: "Plumbing", status: "Needs AI Chatbot" },
    { name: "Fox Service Company", website: "https://www.foxservice.com/", phone: "(512) 488-1120", rating: 4.8, reviews: 5152, category: "Plumbing", status: "Needs AI Chatbot" },
    { name: "Abundant Plumbing", website: "https://popl.co/card/Xsv8ZBBH/1/s", phone: "(512) 201-9978", rating: 5.0, reviews: 6, category: "Plumbing", status: "No Website" },
    { name: "AAA AUGER Plumbing Services", website: "https://www.aaa-auger.com/austin/", phone: "(512) 928-0467", rating: 4.7, reviews: 337, category: "Plumbing", status: "Needs AI Chatbot" },
    { name: "Express Plumbing", website: null, phone: "(737) 345-9535", rating: 5.0, reviews: 16, category: "Plumbing", status: "No Website" },
    { name: "Mendez Family Plumbing & Electrical", website: null, phone: "(512) 813-0488", rating: 4.8, reviews: 98, category: "Plumbing", status: "No Website" },
    { name: "Magic Plumbing ATX", website: "https://www.magicplumbingatx.com/", phone: "(512) 228-9421", rating: 4.9, reviews: 123, category: "Plumbing", status: "Needs AI Chatbot" },
    { name: "SALT Plumbing Air & Electric", website: "https://callsalt.com/", phone: "(737) 386-9507", rating: 4.9, reviews: 1440, category: "Plumbing", status: "Needs AI Chatbot" },
    { name: "McDowd Plumbing", website: "https://mcdowdplumbing.com/", phone: "(737) 419-6916", rating: 5.0, reviews: 50, category: "Plumbing", status: "Needs AI Chatbot" },
    { name: "Benjamin Franklin Plumbing of Central Austin", website: "https://www.benjaminfranklinplumbing.com/central-austin/", phone: "(512) 331-3884", rating: 4.7, reviews: 155, category: "Plumbing", status: "Needs AI Chatbot" },
    { name: "Champion Cooling, Heating & Plumbing", website: "https://www.championacaustin.com/", phone: "(512) 595-3473", rating: 4.8, reviews: 3193, category: "Plumbing", status: "Needs AI Chatbot" },
    { name: "Reliable Plumbing Austin", website: "http://reliableplumbingaustin.com/", phone: "(512) 441-7754", rating: 4.3, reviews: 78, category: "Plumbing", status: "Old Website" },
    { name: "Dinosaur Plumbing", website: null, phone: "(512) 992-5454", rating: 4.7, reviews: 43, category: "Plumbing", status: "No Website" },
    // ── Dental ───────────────────────────────────────────────────────────────
    { name: "Sola Smile Co.", website: "https://solasmileaustin.com/", phone: "(512) 615-9405", rating: 4.9, reviews: 440, category: "Dental", status: "Needs AI Chatbot" },
    { name: "ATX Family Dental", website: "https://www.atxfamilydental.com/", phone: "(512) 717-3147", rating: 4.9, reviews: 798, category: "Dental", status: "Needs AI Chatbot" },
    { name: "Walton Family Dentistry", website: "http://waltonfamilydentistry.com/", phone: "(512) 953-8362", rating: 4.8, reviews: 177, category: "Dental", status: "Old Website" },
    { name: "Elite Dentistry ATX", website: "http://www.elite-dentistry.net/", phone: "(512) 892-9900", rating: 4.7, reviews: 687, category: "Dental", status: "Old Website" },
    { name: "High Point Dentistry", website: "https://highpointsmilestx.com/", phone: "(512) 473-8444", rating: 4.9, reviews: 520, category: "Dental", status: "Needs AI Chatbot" },
    { name: "Toothbar", website: "https://www.toothbar.com/", phone: "(512) 607-4268", rating: 4.9, reviews: 709, category: "Dental", status: "Needs AI Chatbot" },
    { name: "BLVD Dentistry & Orthodontics Riverside", website: "https://www.blvddentistry.com/austin-riverside/", phone: "(512) 640-8747", rating: 4.7, reviews: 924, category: "Dental", status: "Needs AI Chatbot" },
    { name: "Daybreak Dental", website: "https://www.daybreakdentalcare.com/", phone: "(737) 260-5087", rating: 4.9, reviews: 424, category: "Dental", status: "Needs AI Chatbot" },
    { name: "Sunny Days Dental", website: null, phone: "(512) 539-0093", rating: 4.4, reviews: 119, category: "Dental", status: "No Website" },
    { name: "Trey Kaliher, DDS", website: "https://kaliherdentistry.com/", phone: "(512) 453-3100", rating: 5.0, reviews: 394, category: "Dental", status: "Needs AI Chatbot" },
    { name: "Enamel Dentistry South Lamar", website: "https://enameldentistry.com/south-lamar-dentist/", phone: "(512) 588-5231", rating: 4.8, reviews: 1032, category: "Dental", status: "Needs AI Chatbot" },
    { name: "Breeze Dental", website: "https://www.breezeoralcare.com/", phone: "(512) 745-8825", rating: 4.8, reviews: 810, category: "Dental", status: "Needs AI Chatbot" },
    { name: "North Austin Dentistry", website: "https://northaustindentist.com/", phone: "(512) 489-9933", rating: 4.9, reviews: 684, category: "Dental", status: "Needs AI Chatbot" },
    { name: "Swish Dental Downtown", website: "https://www.swishsmiles.com/location/downtown", phone: "(512) 713-1099", rating: 4.6, reviews: 859, category: "Dental", status: "Needs AI Chatbot" },
    { name: "Craft of Dentistry", website: "https://dentistsouthaustintx.com/", phone: "(512) 441-2684", rating: 5.0, reviews: 872, category: "Dental", status: "Needs AI Chatbot" },
    { name: "Castle Dental Austin", website: "https://www.castledental.com/", phone: "(512) 326-4510", rating: 4.1, reviews: 298, category: "Dental", status: "Old Website" },
    { name: "Brident Dental & Orthodontics", website: "https://www.brident.com/", phone: "(512) 822-7275", rating: 3.7, reviews: 775, category: "Dental", status: "Needs AI Chatbot" },
    // ── HVAC ─────────────────────────────────────────────────────────────────
    { name: "ProSolutions Air & Plumbing", website: "https://prosolutionsteam.com/", phone: "(512) 333-7765", rating: 4.8, reviews: 2341, category: "HVAC", status: "Needs AI Chatbot" },
    { name: "Comfort Experts of Austin", website: "http://www.comfortexpertsaustin.com/", phone: "(512) 668-8668", rating: 4.6, reviews: 891, category: "HVAC", status: "Old Website" },
    { name: "Green Choice Air", website: "https://greenchoiceair.com/", phone: "(512) 222-8368", rating: 4.9, reviews: 456, category: "HVAC", status: "Needs AI Chatbot" },
    { name: "Austin Air Masters", website: null, phone: "(512) 756-4929", rating: 4.5, reviews: 34, category: "HVAC", status: "No Website" },
    { name: "One Hour Air Conditioning of Austin", website: "https://www.onehourheatandair.com/austin/", phone: "(512) 677-3131", rating: 4.7, reviews: 3102, category: "HVAC", status: "Needs AI Chatbot" },
    { name: "AccuTemp Services", website: "https://accutemp.net/", phone: "(512) 777-1234", rating: 4.9, reviews: 5621, category: "HVAC", status: "Needs AI Chatbot" },
    { name: "Reliable Heating & Air Austin", website: "http://reliableaustinac.com/", phone: "(512) 444-9988", rating: 4.2, reviews: 127, category: "HVAC", status: "Old Website" },
    { name: "CoolMax HVAC", website: null, phone: "(512) 884-5521", rating: 4.8, reviews: 22, category: "HVAC", status: "No Website" },
    { name: "Stellar Air Services", website: "https://stellairaustin.com/", phone: "(737) 888-3421", rating: 4.9, reviews: 189, category: "HVAC", status: "Needs AI Chatbot" },
    { name: "Aire Serv of Austin", website: "https://www.aireserv.com/austin/", phone: "(512) 866-6456", rating: 4.8, reviews: 1203, category: "HVAC", status: "Needs AI Chatbot" },
    { name: "Austin Climate Control", website: "http://austinclimatecontrol.net/", phone: "(512) 338-5400", rating: 4.4, reviews: 318, category: "HVAC", status: "Old Website" },
    { name: "Texas Pride Heating & Air", website: null, phone: "(512) 901-3311", rating: 4.9, reviews: 29, category: "HVAC", status: "No Website" },
    // ── Roofing ───────────────────────────────────────────────────────────────
    { name: "Austin Roofing & Construction", website: "https://austinroofingandconstruction.com/", phone: "(512) 328-7663", rating: 4.9, reviews: 892, category: "Roofing", status: "Needs AI Chatbot" },
    { name: "Bill Zaborski Roofing", website: "http://www.zaborskiroofing.com/", phone: "(512) 445-3366", rating: 4.8, reviews: 234, category: "Roofing", status: "Old Website" },
    { name: "Monarch Roofing", website: "https://monarchroofingco.com/", phone: "(512) 553-8881", rating: 5.0, reviews: 341, category: "Roofing", status: "Needs AI Chatbot" },
    { name: "Patriot Roofing Solutions", website: "https://patriotroofaustin.com/", phone: "(512) 947-0001", rating: 4.7, reviews: 567, category: "Roofing", status: "Needs AI Chatbot" },
    { name: "Royal Roofing Austin", website: null, phone: "(512) 791-4411", rating: 4.9, reviews: 45, category: "Roofing", status: "No Website" },
    { name: "Peak to Peak Roofing", website: "https://peaktopeakroofing.com/", phone: "(737) 207-0333", rating: 4.8, reviews: 128, category: "Roofing", status: "Needs AI Chatbot" },
    { name: "Superior Roofing Company", website: "http://superiorroofingaustin.com/", phone: "(512) 388-8011", rating: 4.3, reviews: 88, category: "Roofing", status: "Old Website" },
    { name: "Longhorn Roofing", website: "https://longhornroofing.com/", phone: "(512) 833-6446", rating: 4.9, reviews: 1145, category: "Roofing", status: "Needs AI Chatbot" },
    { name: "Storm Guard Roofing Austin", website: "https://stormguard.com/austin/", phone: "(512) 337-5400", rating: 4.7, reviews: 423, category: "Roofing", status: "Needs AI Chatbot" },
    { name: "Texas Traditions Roofing", website: null, phone: "(512) 786-6200", rating: 4.8, reviews: 61, category: "Roofing", status: "No Website" },
    // ── Home Services ─────────────────────────────────────────────────────────
    { name: "Mr. Handyman of Austin", website: "https://www.mrhandyman.com/austin/", phone: "(512) 887-6300", rating: 4.7, reviews: 432, category: "Home Services", status: "Needs AI Chatbot" },
    { name: "Austin Superior Cleaning", website: "http://austinsuperiorcleaning.com/", phone: "(512) 494-3388", rating: 4.5, reviews: 87, category: "Home Services", status: "Old Website" },
    { name: "HomeTeam Pest Defense Austin", website: "https://www.pestdefense.com/austin/", phone: "(512) 302-2400", rating: 4.6, reviews: 654, category: "Home Services", status: "Needs AI Chatbot" },
    { name: "Stanley Steemer Austin", website: "https://www.stanleysteemer.com/", phone: "(512) 836-7114", rating: 4.5, reviews: 1832, category: "Home Services", status: "Needs AI Chatbot" },
    { name: "Duct Dynasty Austin", website: null, phone: "(512) 334-8812", rating: 5.0, reviews: 28, category: "Home Services", status: "No Website" },
    { name: "Austin Gutter King", website: "https://austingutterking.com/", phone: "(512) 999-2155", rating: 4.9, reviews: 213, category: "Home Services", status: "Needs AI Chatbot" },
    { name: "The Grounds Guys of Austin", website: "https://www.groundsguys.com/austin/", phone: "(512) 535-8833", rating: 4.7, reviews: 312, category: "Home Services", status: "Needs AI Chatbot" },
    { name: "Austin Lock & Key", website: "http://www.austinlocksmith.com/", phone: "(512) 614-8050", rating: 4.4, reviews: 445, category: "Home Services", status: "Old Website" },
    { name: "Mighty Clean Home", website: null, phone: "(512) 222-9000", rating: 4.8, reviews: 38, category: "Home Services", status: "No Website" },
    { name: "Green Leaf Air", website: "https://greenleafairAustin.com/", phone: "(512) 641-3838", rating: 4.9, reviews: 178, category: "Home Services", status: "Needs AI Chatbot" },
  ],

  "Stockholm, SE": [
    // ── Plumbing ──────────────────────────────────────────────────────────────
    { name: "Hägersten VVS - Rörmokare Stockholm", website: "https://hagerstenvvs.se/", phone: "08-410 700 32", rating: 4.8, reviews: 156, category: "Plumbing", status: "Needs AI Chatbot" },
    { name: "AM VVS och Bygg AB", website: "https://amvvsbygg.se/", phone: "072-852 99 99", rating: 5.0, reviews: 145, category: "Plumbing", status: "Needs AI Chatbot" },
    { name: "Philip K. VVS - Rörmokare Stockholm", website: "http://www.pkvvs.se/", phone: "08-599 980 77", rating: 4.7, reviews: 70, category: "Plumbing", status: "Old Website" },
    { name: "VVS Kvalitet Stockholm AB", website: "https://vvskvalitet.se/", phone: "08-414 005 50", rating: 5.0, reviews: 233, category: "Plumbing", status: "Needs AI Chatbot" },
    { name: "Cecilia Rör", website: "https://ceciliaror.se/", phone: "072-911 24 08", rating: 5.0, reviews: 2, category: "Plumbing", status: "Needs AI Chatbot" },
    { name: "Svanströms El & VVS AB", website: "https://svanstromsel.se/", phone: "020-15 05 05", rating: 4.7, reviews: 461, category: "Plumbing", status: "Needs AI Chatbot" },
    { name: "Process VVS AB", website: "http://www.provvs.se/", phone: "08-36 52 47", rating: 4.9, reviews: 333, category: "Plumbing", status: "Old Website" },
    { name: "Tapsa Rörsvets VVS", website: null, phone: "070-727 74 11", rating: 5.0, reviews: 1, category: "Plumbing", status: "No Website" },
    { name: "Cyklande Rörmokaren", website: "https://cyklanderörmokaren.se/", phone: "08-500 333 70", rating: 4.7, reviews: 741, category: "Plumbing", status: "Needs AI Chatbot" },
    { name: "Collins Rörservice AB", website: "http://collinsrorservice.se/", phone: "08-600 11 60", rating: 5.0, reviews: 37, category: "Plumbing", status: "Old Website" },
    { name: "Stockholms Cyklande Rörjour", website: "https://www.stockholmscyklanderorjour.se/", phone: "073-960 04 93", rating: 5.0, reviews: 132, category: "Plumbing", status: "Needs AI Chatbot" },
    { name: "Rörassistansen Stockholm", website: null, phone: "08-20 03 33", rating: 3.3, reviews: 15, category: "Plumbing", status: "No Website" },
    { name: "VVS Finess Stockholm AB", website: "https://www.vvsfiness.se/", phone: "010-750 05 85", rating: 5.0, reviews: 21, category: "Plumbing", status: "Needs AI Chatbot" },
    { name: "Södermalms VVS & Rörmokeri", website: "http://vvs-sodermalm.se/", phone: null, rating: 3.8, reviews: 8, category: "Plumbing", status: "Old Website" },
    { name: "Rörmannen i Bromma AB", website: "http://www.rormannen.se/", phone: "08-36 28 61", rating: 4.2, reviews: 83, category: "Plumbing", status: "Old Website" },
    { name: "Jouren 24 Sverige AB", website: "https://www.jouren24.se/", phone: "08-30 98 88", rating: 4.8, reviews: 90, category: "Plumbing", status: "Needs AI Chatbot" },
    { name: "Stureplans Rör AB", website: "http://www.stureplansror.se/", phone: "070-092 65 72", rating: 4.9, reviews: 7, category: "Plumbing", status: "Old Website" },
    { name: "Söderorts VVS och Bygg AB", website: "https://vvsochbygg.nu/", phone: "08-35 31 30", rating: 4.8, reviews: 26, category: "Plumbing", status: "Needs AI Chatbot" },
    // ── Dental ───────────────────────────────────────────────────────────────
    { name: "Vitsmile Tandklinik Stockholm", website: "https://www.vitsmile.se/", phone: "08-612 52 20", rating: 4.9, reviews: 312, category: "Dental", status: "Needs AI Chatbot" },
    { name: "Folktandvården Kungsholmen", website: "https://www.folktandvardenstockholm.se/", phone: "08-123 456 78", rating: 4.2, reviews: 156, category: "Dental", status: "Old Website" },
    { name: "Dentalkliniken Södermalm", website: "https://dentalkliniken.se/", phone: "08-643 22 33", rating: 4.8, reviews: 241, category: "Dental", status: "Needs AI Chatbot" },
    { name: "Nordic Dental Clinic Stockholm", website: "https://nordicdental.se/", phone: "08-654 88 77", rating: 4.9, reviews: 178, category: "Dental", status: "Needs AI Chatbot" },
    { name: "City Tandvård Stockholm", website: "http://citytandvard.se/", phone: "08-22 11 55", rating: 4.7, reviews: 198, category: "Dental", status: "Old Website" },
    { name: "Sthlm Tandvård", website: null, phone: "073-456 78 90", rating: 4.5, reviews: 12, category: "Dental", status: "No Website" },
    { name: "Mariatorgets Tandklinik", website: "http://mariatorget-tandklinik.se/", phone: "08-642 35 70", rating: 4.6, reviews: 67, category: "Dental", status: "Old Website" },
    { name: "Östermalm Tandläkare", website: "https://ostermalmtandlakare.se/", phone: "08-660 98 87", rating: 4.9, reviews: 287, category: "Dental", status: "Needs AI Chatbot" },
    { name: "Södermalm Tandvård AB", website: null, phone: "08-644 55 66", rating: 4.4, reviews: 34, category: "Dental", status: "No Website" },
    // ── HVAC ─────────────────────────────────────────────────────────────────
    { name: "Stockholms Värme & Ventilation", website: "https://stockholmsvvs.se/", phone: "08-555 22 11", rating: 4.8, reviews: 145, category: "HVAC", status: "Needs AI Chatbot" },
    { name: "KG Mark VVS & Ventilation", website: "http://www.kgmark.se/", phone: "08-556 33 44", rating: 4.6, reviews: 78, category: "HVAC", status: "Old Website" },
    { name: "Nordic Climate Control", website: "https://nordicclimate.se/", phone: "073-888 22 11", rating: 4.9, reviews: 92, category: "HVAC", status: "Needs AI Chatbot" },
    { name: "Stockholm Ventilation AB", website: null, phone: "070-234 56 78", rating: 4.7, reviews: 18, category: "HVAC", status: "No Website" },
    { name: "Air Solutions Nordic AB", website: "https://airsolutions.se/", phone: "08-33 44 55", rating: 4.8, reviews: 56, category: "HVAC", status: "Needs AI Chatbot" },
    { name: "Solvent Klimat AB", website: "http://solventklimat.se/", phone: "08-777 12 34", rating: 4.5, reviews: 44, category: "HVAC", status: "Old Website" },
  ],

  "Gothenburg, SE": [
    // ── Electrician ───────────────────────────────────────────────────────────
    { name: "intELin AB", website: "http://www.intelin.se/", phone: "031-25 56 16", rating: 5.0, reviews: 11, category: "Electrician", status: "Old Website" },
    { name: "EL SHAPO AB", website: "http://www.elshapo.com/", phone: "073-612 01 43", rating: 5.0, reviews: 169, category: "Electrician", status: "Old Website" },
    { name: "FAD El & Konsulting AB", website: "https://fad-el.se/", phone: "072-763 63 06", rating: 5.0, reviews: 15, category: "Electrician", status: "Needs AI Chatbot" },
    { name: "365 Elteknik AB", website: "http://www.365elteknik.com/", phone: "076-036 53 65", rating: 5.0, reviews: 3, category: "Electrician", status: "Old Website" },
    { name: "Göteborg Elektriker", website: "http://goteborgelektriker.se/", phone: "010-147 69 72", rating: 4.4, reviews: 45, category: "Electrician", status: "Old Website" },
    { name: "Zotterman EL", website: "https://zottermanel.se/", phone: "070-597 66 30", rating: 5.0, reviews: 6, category: "Electrician", status: "Needs AI Chatbot" },
    { name: "El-Fast Göteborg AB", website: "http://www.elfastgbg.se/", phone: "031-702 00 40", rating: 4.7, reviews: 23, category: "Electrician", status: "Old Website" },
    { name: "Göteborgs Elteam AB", website: "http://www.gbgelteam.se/", phone: "076-391 03 18", rating: 4.9, reviews: 15, category: "Electrician", status: "Old Website" },
    { name: "Laddexperten", website: "https://www.laddexperten.se/", phone: "079-300 08 52", rating: 5.0, reviews: 40, category: "Electrician", status: "Needs AI Chatbot" },
    { name: "El-Elit AB", website: "https://www.elelit.se/", phone: "031-338 03 90", rating: 5.0, reviews: 20, category: "Electrician", status: "Needs AI Chatbot" },
    { name: "Göteborg El & Installation", website: null, phone: "073-123 45 67", rating: 4.8, reviews: 14, category: "Electrician", status: "No Website" },
    { name: "Hisingen Elektriker", website: "https://hisingenelektriker.se/", phone: "031-33 22 11", rating: 4.9, reviews: 88, category: "Electrician", status: "Needs AI Chatbot" },
    // ── Plumbing ──────────────────────────────────────────────────────────────
    { name: "Göteborg Rörmokare AB", website: "https://goteborgrormokare.se/", phone: "031-22 44 66", rating: 4.8, reviews: 134, category: "Plumbing", status: "Needs AI Chatbot" },
    { name: "Hisingen VVS & Rörmokeri", website: "http://hisingenvvs.se/", phone: "031-56 78 90", rating: 4.6, reviews: 89, category: "Plumbing", status: "Old Website" },
    { name: "Majorna Rörmokare", website: null, phone: "072-345 67 89", rating: 4.9, reviews: 23, category: "Plumbing", status: "No Website" },
    { name: "VVS Service Göteborg", website: "https://vvsservicegbg.se/", phone: "031-44 55 66", rating: 4.7, reviews: 198, category: "Plumbing", status: "Needs AI Chatbot" },
    { name: "Lindome Rörläggning", website: "http://linrormokare.se/", phone: "031-77 88 99", rating: 4.5, reviews: 45, category: "Plumbing", status: "Old Website" },
    { name: "Kungsbacka VVS", website: "https://kungsbackavvs.se/", phone: "0300-12 34 56", rating: 4.9, reviews: 67, category: "Plumbing", status: "Needs AI Chatbot" },
    { name: "Partille Rörmokare & VVS", website: null, phone: "031-26 44 55", rating: 4.8, reviews: 34, category: "Plumbing", status: "No Website" },
    { name: "Mölndal VVS AB", website: "https://molndalvvs.se/", phone: "031-87 65 43", rating: 4.7, reviews: 112, category: "Plumbing", status: "Needs AI Chatbot" },
    // ── Dental ───────────────────────────────────────────────────────────────
    { name: "Göteborg Tandklinik", website: "https://goteborgtandklinik.se/", phone: "031-22 33 44", rating: 4.8, reviews: 267, category: "Dental", status: "Needs AI Chatbot" },
    { name: "Haga Tandläkare", website: "http://hagatand.se/", phone: "031-44 55 66", rating: 4.7, reviews: 156, category: "Dental", status: "Old Website" },
    { name: "Smile Göteborg", website: "https://www.smile.se/goteborg/", phone: "031-55 44 33", rating: 4.8, reviews: 412, category: "Dental", status: "Needs AI Chatbot" },
    { name: "Tandläkare Linnéstaden", website: null, phone: "073-567 89 01", rating: 4.9, reviews: 18, category: "Dental", status: "No Website" },
    { name: "Frölunda Tandvård", website: "https://frolundatandvard.se/", phone: "031-66 77 88", rating: 4.6, reviews: 89, category: "Dental", status: "Needs AI Chatbot" },
    { name: "Askim Tandläkare", website: "http://askimtand.se/", phone: "031-28 11 22", rating: 4.8, reviews: 74, category: "Dental", status: "Old Website" },
    { name: "Centrum Tandvård Göteborg", website: "https://centrumtandvard.se/", phone: "031-13 24 35", rating: 4.9, reviews: 198, category: "Dental", status: "Needs AI Chatbot" },
  ],

  "Västerås, SE": [
    // ── Dental ───────────────────────────────────────────────────────────────
    { name: "Folktandvården Adelsö", website: "https://www.1177.se/Vastmanland/", phone: "021-17 50 50", rating: 3.0, reviews: 30, category: "Dental", status: "Old Website" },
    { name: "Folktandvården Oxbacken", website: "https://www.1177.se/Vastmanland/", phone: "021-17 67 80", rating: 3.6, reviews: 25, category: "Dental", status: "Old Website" },
    { name: "Hammarby Tandklinik", website: "https://m.facebook.com/hammarby.tandklinik/", phone: "076-273 62 11", rating: 4.4, reviews: 71, category: "Dental", status: "Old Website" },
    { name: "Vasteras Dental Health", website: "https://www.vasterastandhalsa.com/", phone: "021-13 85 10", rating: 4.9, reviews: 43, category: "Dental", status: "Needs AI Chatbot" },
    { name: "Tandläkare Ruaa Al-Ghabban", website: "http://www.tandoestetik.se/", phone: "072-570 29 00", rating: 4.8, reviews: 50, category: "Dental", status: "Old Website" },
    { name: "Västerås Dentalcenter", website: null, phone: "070-284 14 73", rating: 4.3, reviews: 31, category: "Dental", status: "No Website" },
    { name: "Aqua Dental", website: "https://www.aquadental.se/", phone: "021-372 02 50", rating: 4.1, reviews: 166, category: "Dental", status: "Needs AI Chatbot" },
    { name: "Västeråstandläkarna", website: "http://www.vasterastandlakarna.se/", phone: "021-12 08 90", rating: 5.0, reviews: 157, category: "Dental", status: "Old Website" },
    { name: "Smile Västerås", website: "https://www.smile.se/vasteras/", phone: "021-13 46 80", rating: 4.8, reviews: 342, category: "Dental", status: "Needs AI Chatbot" },
    { name: "Tandläkare Norenius", website: "http://www.norenius.se/", phone: "021-12 52 53", rating: 5.0, reviews: 100, category: "Dental", status: "Old Website" },
    { name: "Manfredkliniken", website: "http://www.ptj.se/manfredkliniken", phone: "021-41 14 00", rating: 4.6, reviews: 8, category: "Dental", status: "Old Website" },
    { name: "Stortorgets Tandläkare", website: null, phone: "021-41 22 33", rating: 4.7, reviews: 22, category: "Dental", status: "No Website" },
    // ── Plumbing ──────────────────────────────────────────────────────────────
    { name: "Västerås Rörmokare", website: "https://vasterasrormokare.se/", phone: "021-123 45 67", rating: 4.8, reviews: 78, category: "Plumbing", status: "Needs AI Chatbot" },
    { name: "Mälardalen VVS AB", website: "http://malardalen-vvs.se/", phone: "021-234 56 78", rating: 4.6, reviews: 45, category: "Plumbing", status: "Old Website" },
    { name: "City Rör Västerås", website: null, phone: "070-123 45 67", rating: 4.9, reviews: 15, category: "Plumbing", status: "No Website" },
    { name: "VVS Service Västerås", website: "https://vvsservicevasteras.se/", phone: "021-345 67 89", rating: 4.7, reviews: 92, category: "Plumbing", status: "Needs AI Chatbot" },
    { name: "Hallstahammar Rörmokeri", website: "https://hallstahammarrormokeri.se/", phone: "0220-123 45", rating: 4.8, reviews: 34, category: "Plumbing", status: "Needs AI Chatbot" },
    { name: "Sala VVS & Rörmokare", website: null, phone: "0224-56 78 90", rating: 4.5, reviews: 28, category: "Plumbing", status: "No Website" },
    // ── Electrician ───────────────────────────────────────────────────────────
    { name: "Västerås El AB", website: "https://vasterasel.se/", phone: "021-456 78 90", rating: 4.9, reviews: 89, category: "Electrician", status: "Needs AI Chatbot" },
    { name: "Mälaren Elektriker", website: "http://malarenelektriker.se/", phone: "021-567 89 01", rating: 4.7, reviews: 56, category: "Electrician", status: "Old Website" },
    { name: "City El Västerås", website: null, phone: "070-234 56 78", rating: 4.8, reviews: 12, category: "Electrician", status: "No Website" },
    { name: "Nordisk El & Installation", website: "https://nordiskel.se/", phone: "021-678 90 12", rating: 4.8, reviews: 134, category: "Electrician", status: "Needs AI Chatbot" },
    { name: "Elektro Vision Västerås", website: "https://elektrovision.se/", phone: "021-789 01 23", rating: 4.9, reviews: 67, category: "Electrician", status: "Needs AI Chatbot" },
  ],
}

export function getLeadsByCity(cityName: string): any[] {
  const leads = masterCityData[cityName] || []
  if (leads.length === 0) return []

  const maxReviews = Math.max(...leads.map((l: any) => l.reviews || 1))
  const countryPenalty = cityName.includes(", TX") ? 15 : 0

  return leads.map((lead: any, index: number) => {
    const nameSeed = lead.name.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0)
    const seed2 = (nameSeed * 1664525 + 1013904223) % (2 ** 31)

    // Spread markers more naturally using two different trig functions
    const scatterTop = 12 + Math.abs(Math.sin(nameSeed * 12.9898 + index * 0.4) * 76)
    const scatterLeft = 8 + Math.abs(Math.cos(nameSeed * 78.233 + index * 0.31) * 84)
    const top = Math.max(6, Math.min(93, scatterTop))
    const left = Math.max(6, Math.min(93, scatterLeft))

    const isNoSite = lead.status === "No Website"
    const isOldSite = lead.status === "Old Website"
    const needsBot = lead.status === "Needs AI Chatbot"
    const hasWebsite = !!lead.website
    const isHttps = hasWebsite && lead.website.startsWith('https://')
    const isSocialSite = hasWebsite && (
      lead.website.includes('facebook.com') ||
      lead.website.includes('1177.se') ||
      lead.website.includes('popl.co')
    )

    const reviewScore = Math.min(100, (Math.log10(Math.max(lead.reviews || 1, 1)) / Math.log10(maxReviews)) * 100)
    const ratingScore = lead.rating ? Math.min(100, ((lead.rating - 1) / 4) * 100) : 0
    const v = (nameSeed % 14) - 7 // deterministic variance -7 to +7

    const websiteBonus = !hasWebsite ? 0 : isSocialSite ? 4 : isHttps ? 22 : 12

    const seo = isNoSite ? 0 : Math.max(4, Math.min(93, Math.round(
      reviewScore * 0.38 + ratingScore * 0.38 +
      websiteBonus -
      (lead.reviews < 50 ? 18 : 0) -
      (lead.reviews < 10 ? 10 : 0) -
      (lead.rating < 4.0 ? 12 : 0) -
      (!lead.phone ? 5 : 0) -
      countryPenalty + v
    )))

    const mobileFriendliness = isNoSite ? 0 : Math.max(8, Math.min(93, Math.round(
      (hasWebsite ? 38 : 5) +
      (isHttps ? 18 : 0) -
      (isSocialSite ? 22 : 0) -
      (isOldSite ? 20 : 0) +
      ratingScore * 0.25 +
      (seed2 % 16) - 5
    )))

    const chatbotPresence = isNoSite ? 0 :
      needsBot ? Math.max(0, Math.min(14, Math.round(3 + (nameSeed % 10)))) :
      isOldSite ? Math.max(0, Math.min(28, Math.round(8 + (seed2 % 18)))) :
      Math.max(30, Math.min(90, Math.round(40 + reviewScore * 0.25 + (nameSeed % 22))))

    const pageSpeed = isNoSite ? 0 : Math.max(10, Math.min(93, Math.round(
      (hasWebsite ? 42 : 8) +
      (isHttps ? 16 : 0) -
      (isSocialSite ? 18 : 0) -
      (isOldSite ? 22 : 0) +
      (lead.rating >= 4.5 ? 8 : 0) +
      (seed2 % 20) - 7
    )))

    const socialPresence = Math.max(5, Math.min(91, Math.round(
      (lead.reviews > 500 ? 55 : lead.reviews > 100 ? 38 : lead.reviews > 20 ? 20 : 8) +
      (lead.rating >= 4.5 ? 15 : lead.rating >= 4.0 ? 8 : 0) +
      (hasWebsite ? 10 : 0) +
      (seed2 % 18) - 6
    )))

    return {
      ...lead,
      id: `${cityName.replace(/\s+/g, '')}-${index}`,
      mapPos: { top: `${top}%`, left: `${left}%` },
      audit: { seo, mobileFriendliness, chatbotPresence, pageSpeed, socialPresence }
    }
  })
}

export const mockLeads = getLeadsByCity("Austin, TX")
