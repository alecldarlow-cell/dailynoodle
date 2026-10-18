/* Digi Puzzles — mini engine. One copy serves every mini page in reports/.
   Extracted 2026-10-15 from 2028-08-14-crossword-mini-0765.html by tools/engine-shells.js.
   The page supplies its puzzle as window.DN_PUZZLE before loading this file.
   Edit here to change every mini; keep element ids and localStorage keys
   stable (dn-track.js and players' saved progress depend on them). */


const WORDS={"3":{"aaa":3,"abc":2,"abs":3,"ace":2,"act":1,"add":1,"ads":2,"aft":3,"age":1,"ago":1,"aha":3,"aid":1,"aim":1,"air":1,"ale":3,"all":1,"alp":4,"alt":2,"amp":2,"and":1,"ant":2,"any":1,"ape":3,"apr":2,"apt":3,"arc":2,"are":1,"ark":3,"arm":1,"art":1,"ash":2,"ask":1,"ate":2,"aug":2,"awe":2,"axe":3,"aye":3,"bad":1,"bag":1,"ban":1,"bap":4,"bar":1,"bat":2,"bay":2,"bed":1,"bee":3,"beg":2,"bet":1,"bib":4,"bid":2,"big":1,"bin":2,"bit":1,"boa":4,"bog":3,"boo":2,"bop":3,"bot":2,"bow":2,"box":1,"boy":1,"bra":2,"bud":3,"bug":2,"bum":3,"bun":3,"bus":1,"but":1,"buy":1,"bye":2,"cab":2,"cad":3,"can":1,"cap":1,"car":1,"cat":2,"chi":2,"cod":2,"col":2,"con":2,"coo":3,"cop":2,"cos":2,"cow":2,"cox":2,"coy":4,"cpu":3,"cry":1,"cub":3,"cue":3,"cup":1,"cut":1,"dab":3,"dad":1,"dam":2,"das":3,"day":1,"dec":2,"den":2,"dew":3,"did":1,"die":1,"dig":2,"dim":3,"din":3,"dip":2,"doc":2,"doe":3,"dog":1,"don":3,"dot":3,"dry":1,"dub":3,"due":1,"dug":2,"duo":2,"dye":2,"ear":2,"eat":1,"ebb":4,"eds":3,"eel":4,"egg":2,"ego":2,"elf":3,"elk":3,"elm":3,"end":1,"eon":4,"epa":2,"era":1,"err":3,"est":2,"etc":1,"eve":2,"eye":1,"fab":3,"fan":1,"far":1,"fat":1,"fax":3,"fed":1,"fee":1,"few":1,"fib":4,"fig":2,"fin":3,"fir":3,"fit":1,"fix":1,"flu":2,"fly":1,"foe":3,"fog":2,"for":1,"fox":2,"fry":2,"fun":1,"fur":2,"gag":3,"gal":2,"gap":2,"gas":1,"gee":3,"gel":2,"gem":2,"get":1,"gig":2,"gin":3,"god":1,"goo":3,"got":1,"gum":2,"gun":1,"gut":2,"guy":1,"gym":2,"had":1,"ham":2,"has":1,"hat":1,"hay":2,"hem":4,"hen":3,"her":1,"hes":2,"hex":3,"hey":1,"hid":3,"him":1,"hip":2,"his":1,"hit":1,"hog":3,"hop":2,"hot":1,"how":1,"hub":2,"hue":3,"hug":2,"huh":2,"hum":3,"hut":2,"ice":1,"icy":3,"iii":1,"ilk":4,"ill":1,"imp":4,"ink":2,"inn":2,"ion":2,"irs":2,"its":1,"ivy":3,"jab":3,"jam":2,"jar":2,"jaw":2,"jet":2,"jew":2,"jig":4,"job":1,"jog":3,"jot":4,"joy":2,"jug":3,"keg":4,"key":1,"kid":1,"kin":3,"kit":2,"lab":2,"lad":2,"lag":3,"lap":2,"las":2,"law":1,"lax":3,"lay":2,"lbs":2,"lea":3,"led":1,"leg":1,"let":1,"lid":2,"lie":1,"lip":2,"lit":2,"lob":4,"log":2,"loo":3,"lot":1,"low":1,"mac":2,"mad":1,"man":1,"map":1,"mar":2,"mat":2,"max":3,"may":1,"med":2,"men":1,"met":1,"mew":4,"mid":1,"mil":3,"min":3,"mix":1,"mob":2,"mod":2,"mol":4,"mom":1,"mon":2,"moo":4,"mop":3,"mph":2,"mud":2,"mug":3,"mum":2,"nan":3,"nap":2,"nay":3,"neo":2,"net":1,"new":1,"nib":4,"nil":3,"nip":3,"nod":3,"non":1,"not":1,"nov":2,"now":1,"nun":3,"nut":2,"oak":2,"oat":4,"oct":2,"odd":2,"ode":3,"off":1,"oil":1,"old":1,"one":1,"ooh":3,"opt":2,"ore":2,"our":1,"out":1,"owe":2,"owl":2,"own":1,"pac":2,"pad":2,"pal":2,"pan":2,"par":2,"paw":3,"pay":1,"pea":3,"pee":2,"peg":3,"pen":2,"per":1,"pet":2,"pew":3,"pic":2,"pie":2,"pig":2,"pin":2,"pip":3,"pit":2,"ply":4,"pod":3,"pop":1,"pos":3,"pot":2,"pow":3,"pro":1,"pry":4,"pub":2,"pug":4,"pun":3,"pup":3,"put":1,"rad":3,"rag":3,"ram":2,"ran":1,"rap":2,"rat":2,"raw":1,"ray":2,"red":1,"ref":2,"rep":2,"rev":2,"rib":3,"rid":1,"rig":2,"rim":2,"rip":2,"rob":2,"rod":2,"roe":3,"rom":3,"rot":3,"row":2,"rub":2,"rue":3,"rug":3,"rum":3,"run":1,"rut":4,"rye":3,"sac":3,"sad":1,"sag":3,"sap":3,"sat":1,"saw":1,"say":1,"sea":1,"sec":2,"see":1,"sep":2,"set":1,"sew":3,"sex":1,"she":1,"shy":2,"sin":2,"sip":3,"sir":1,"sis":3,"sit":1,"six":1,"ski":2,"sky":2,"sly":3,"son":1,"sow":3,"soy":3,"spa":2,"spy":2,"sub":1,"sum":2,"sun":1,"sup":3,"tab":3,"tad":3,"tag":2,"tan":3,"tap":2,"tar":3,"tat":3,"tax":1,"tea":1,"tee":2,"ten":1,"the":1,"tho":2,"tic":4,"tie":1,"tin":2,"tip":1,"toe":2,"ton":2,"too":1,"top":1,"tor":3,"tot":4,"tow":3,"toy":2,"try":1,"tub":2,"tug":3,"two":1,"ugh":2,"ups":2,"urn":4,"use":1,"van":2,"vat":3,"vet":2,"vex":4,"via":1,"vie":3,"vii":2,"vip":3,"vow":3,"wan":2,"war":1,"was":1,"wax":2,"way":1,"web":2,"wee":2,"wet":1,"who":1,"why":1,"wig":3,"win":1,"wit":3,"woe":3,"won":1,"woo":2,"wow":1,"xxx":3,"yak":4,"yay":2,"yea":2,"yen":3,"yep":2,"yes":1,"yet":1,"you":1,"zen":3,"zip":2,"zoo":2},"4":{"able":1,"aced":4,"aces":3,"ache":3,"acid":2,"acne":3,"acre":2,"acts":1,"adds":2,"aeon":4,"afar":3,"afro":3,"aged":1,"ages":1,"ahem":3,"aide":3,"aids":2,"aims":2,"airs":3,"airy":3,"akin":3,"alas":3,"ally":2,"alps":3,"also":1,"alto":3,"alum":3,"amen":2,"amid":3,"amir":3,"ammo":3,"amps":4,"anal":2,"anew":3,"anon":3,"ante":3,"anti":1,"ants":3,"anus":3,"apes":3,"apex":3,"aqua":3,"arab":2,"arch":2,"arcs":3,"area":1,"aria":3,"arid":3,"arms":1,"army":1,"arts":1,"asap":2,"asks":2,"atom":3,"atop":3,"aunt":2,"aura":3,"auto":2,"avid":3,"away":1,"awed":4,"awry":4,"axed":4,"axes":3,"axis":2,"axle":3,"baba":3,"babe":2,"baby":1,"bach":3,"back":1,"bade":4,"bags":2,"bail":2,"bait":2,"bake":2,"bald":2,"bale":3,"balk":4,"ball":1,"balm":3,"band":1,"bane":3,"bang":2,"bank":1,"bans":3,"barb":3,"bard":3,"bare":2,"bark":2,"barn":3,"bars":2,"base":1,"bash":2,"bask":4,"bass":2,"bath":2,"bats":2,"bays":3,"bead":3,"beak":3,"beam":2,"bean":2,"bear":2,"beat":1,"beau":3,"beds":2,"beef":2,"been":1,"beep":3,"beer":1,"bees":2,"begs":3,"bell":2,"belt":2,"bend":2,"bent":2,"berg":3,"best":1,"beta":2,"bets":2,"bias":2,"bids":2,"bike":1,"bile":3,"bill":1,"bind":3,"bins":3,"bird":2,"bite":2,"bits":2,"blah":2,"bled":3,"blew":2,"blob":4,"bloc":3,"blog":2,"blot":4,"blow":1,"blue":1,"blur":3,"boar":3,"boat":1,"bode":4,"body":1,"bogs":4,"boil":2,"bold":2,"bolt":2,"bomb":1,"bond":1,"bone":2,"bong":3,"bony":3,"boob":3,"book":1,"boom":2,"boon":3,"boos":4,"boot":2,"bore":2,"born":1,"boss":1,"both":1,"bots":3,"bout":2,"bowl":1,"bows":3,"boys":1,"brag":3,"bran":3,"bras":3,"brat":3,"bray":3,"bred":3,"brew":3,"brig":3,"brim":4,"brow":3,"buck":3,"buds":3,"buff":3,"bugs":2,"bulb":3,"bulk":2,"bull":2,"bump":2,"bunk":3,"buns":3,"bunt":4,"burn":1,"burr":3,"bury":2,"bush":2,"bust":2,"busy":1,"butt":2,"buys":2,"buzz":2,"cabs":4,"cafe":2,"cage":2,"cake":1,"calf":3,"call":1,"calm":1,"came":1,"camp":1,"cams":3,"cane":3,"cans":2,"cant":2,"cape":2,"caps":2,"card":1,"care":1,"carp":4,"cars":1,"cart":2,"case":1,"cash":1,"cast":1,"cats":2,"cave":2,"cell":1,"cent":1,"chad":3,"chap":3,"char":3,"chat":1,"chef":2,"chew":3,"chic":3,"chin":2,"chip":2,"chop":3,"chow":3,"chug":4,"cite":3,"city":1,"clad":3,"clam":3,"clan":2,"clap":3,"claw":3,"clay":2,"clip":2,"clog":4,"clot":4,"club":1,"clue":2,"coal":2,"coat":2,"coax":4,"coca":3,"coco":3,"code":1,"coil":3,"coin":2,"coke":2,"cola":3,"cold":1,"colt":3,"coma":3,"comb":3,"come":1,"comp":2,"cone":2,"conn":3,"cons":3,"cook":1,"cool":1,"coop":3,"cope":2,"cops":2,"copy":1,"cord":2,"core":1,"cork":3,"corn":2,"cost":1,"cosy":3,"coup":2,"cove":3,"cows":2,"cozy":3,"crab":3,"cram":4,"crew":1,"crib":3,"crop":2,"crow":2,"cube":2,"cubs":2,"cues":3,"cuff":3,"cult":2,"cunt":2,"cups":2,"curb":3,"cure":2,"curl":3,"cusp":4,"cute":1,"cuts":2,"cyst":4,"dabs":4,"dads":3,"daft":3,"dale":3,"dame":2,"damp":3,"dams":3,"dank":3,"dare":2,"dark":1,"darn":3,"dart":3,"dash":2,"data":1,"date":1,"dawn":2,"days":1,"dead":1,"deaf":2,"deal":1,"dean":2,"dear":1,"debt":1,"deck":2,"deco":3,"deed":3,"deem":3,"deep":1,"deer":2,"defy":3,"deli":3,"demo":2,"dent":3,"deny":2,"desk":2,"dial":2,"dice":3,"died":1,"dies":2,"diet":1,"digs":3,"dime":3,"dine":3,"ding":3,"dips":3,"dire":3,"dirt":2,"disc":2,"dish":2,"disk":2,"diva":3,"dive":2,"dock":2,"docs":3,"does":1,"dogs":1,"dole":3,"doll":3,"dome":2,"done":1,"dong":3,"dons":4,"doom":2,"door":1,"dope":2,"dorm":3,"dose":2,"dots":3,"dove":3,"down":1,"drab":4,"drag":2,"draw":1,"drew":2,"drip":3,"drop":1,"drug":1,"drum":2,"dual":2,"dubs":4,"duck":2,"duct":3,"dude":1,"duel":3,"dues":3,"duet":3,"duff":3,"duke":2,"dull":2,"duly":3,"dumb":1,"dump":2,"dune":3,"dung":3,"dunk":3,"dusk":3,"dust":2,"duty":1,"dyed":3,"dyer":3,"dyes":3,"dyke":3,"each":1,"earl":2,"earn":2,"ears":2,"ease":2,"east":1,"easy":1,"eats":2,"echo":2,"edge":1,"edgy":3,"edit":2,"eggs":1,"else":1,"emit":3,"ends":1,"envy":2,"epic":2,"eras":3,"erie":3,"etch":4,"euro":2,"even":1,"ever":1,"evil":1,"exam":2,"exec":3,"exit":2,"expo":3,"eyed":2,"eyes":1,"face":1,"fact":1,"fade":2,"fail":1,"fair":1,"fake":1,"fall":1,"fame":2,"fang":3,"fans":1,"fare":2,"farm":1,"fars":4,"fart":3,"fast":1,"fate":2,"fats":3,"faux":3,"faze":4,"fear":1,"feat":2,"feds":3,"feed":1,"feel":1,"fees":1,"feet":1,"fell":1,"felt":1,"fend":3,"fern":3,"fest":3,"fete":4,"feud":3,"fiat":3,"fife":3,"figs":3,"file":1,"fill":1,"film":1,"find":1,"fine":1,"fins":3,"fire":1,"firm":1,"fish":1,"fist":2,"fits":2,"five":1,"flag":1,"flap":3,"flat":1,"flaw":3,"flea":3,"fled":2,"flee":2,"flew":2,"flex":3,"flip":2,"flit":4,"flop":3,"flow":1,"flux":3,"foam":3,"foes":3,"foil":3,"fold":2,"folk":2,"fond":2,"font":2,"food":1,"fool":2,"foot":1,"fore":3,"fork":2,"form":1,"fort":2,"foul":2,"four":1,"fowl":4,"frat":3,"fray":3,"free":1,"fret":3,"frog":2,"from":1,"fuck":1,"fuel":1,"fuji":3,"full":1,"fund":1,"funk":3,"furs":4,"fury":2,"fuse":3,"fuss":3,"fuzz":4,"gaga":3,"gage":3,"gags":4,"gain":1,"gala":3,"gale":3,"gall":3,"gals":3,"game":1,"gang":1,"gape":4,"gaps":2,"garb":4,"gash":4,"gasp":3,"gass":4,"gate":2,"gave":1,"gays":3,"gaze":3,"gear":2,"geek":3,"gems":3,"gene":2,"germ":3,"gets":1,"gift":1,"gigs":3,"gill":3,"gilt":4,"girl":1,"give":1,"glad":1,"glee":3,"glen":3,"glow":2,"glue":2,"glut":4,"goal":1,"goat":2,"gods":2,"goes":1,"gold":1,"golf":1,"gone":1,"gong":3,"good":1,"gore":3,"gory":4,"gosh":3,"goth":3,"gout":4,"gown":3,"grab":1,"grad":3,"gram":3,"grew":1,"grey":2,"grid":2,"grim":3,"grin":3,"grip":2,"grit":3,"grow":1,"gulf":2,"gums":3,"guns":1,"guru":2,"gush":4,"guts":3,"guys":1,"hack":2,"hail":2,"hair":1,"hale":3,"half":1,"hall":2,"halo":3,"halt":2,"hams":4,"hand":1,"hang":1,"hard":1,"hare":3,"harm":2,"harp":3,"hash":3,"hate":1,"hath":3,"hats":2,"haul":2,"have":1,"hawk":2,"hays":4,"haze":3,"hazy":4,"head":1,"heal":2,"heap":3,"hear":1,"heat":1,"heck":3,"heed":3,"heel":2,"heir":2,"held":1,"hell":1,"helm":3,"help":1,"hemp":3,"hens":3,"herb":3,"herd":3,"here":1,"hero":1,"herr":3,"hers":3,"hide":1,"high":1,"hike":2,"hill":2,"hilt":4,"hind":3,"hint":2,"hips":3,"hire":2,"hits":1,"hive":3,"hoax":3,"hogs":4,"hold":1,"hole":1,"holy":1,"home":1,"homo":3,"hood":2,"hoof":4,"hook":2,"hoop":3,"hoot":4,"hope":1,"hops":3,"horn":2,"hose":3,"host":1,"hour":1,"hove":4,"hubs":3,"hued":4,"hues":4,"huge":1,"hugs":3,"hulk":3,"hull":2,"hump":3,"hums":4,"hung":2,"hunt":2,"hurt":1,"hush":3,"huts":3,"hymn":3,"hype":2,"iced":3,"ices":4,"icon":2,"idea":1,"idle":3,"idly":4,"idol":2,"ills":4,"imam":3,"inch":2,"info":1,"inks":4,"inns":4,"into":1,"ions":3,"iowa":2,"iris":3,"iron":1,"isle":3,"itch":3,"item":1,"jabs":4,"jack":2,"jade":3,"jail":1,"jams":3,"jars":3,"java":2,"jaws":3,"jays":3,"jazz":2,"jean":3,"jeep":3,"jerk":2,"jest":4,"jets":2,"jews":2,"jibe":4,"jigs":4,"jive":4,"jobs":1,"join":1,"joke":1,"jolt":4,"joys":3,"judo":3,"jugs":4,"juju":4,"july":1,"jump":1,"junk":2,"jury":2,"just":1,"kale":3,"keen":2,"keep":1,"kept":1,"keys":2,"khan":2,"kick":1,"kids":1,"kill":1,"kind":1,"king":1,"kink":3,"kiss":1,"kite":3,"kits":3,"kiwi":3,"knee":2,"knew":1,"knit":3,"knot":3,"know":1,"labs":2,"lace":2,"lack":1,"lads":2,"lady":1,"lags":4,"laid":1,"lain":4,"lair":3,"lake":1,"lakh":3,"lama":3,"lamb":3,"lame":2,"lamp":2,"land":1,"lane":2,"laos":3,"laps":3,"lash":3,"last":1,"late":1,"lava":3,"lawn":2,"laws":1,"lays":3,"lazy":2,"lead":1,"leaf":2,"leak":2,"lean":2,"leap":2,"leer":4,"left":1,"legs":1,"lend":2,"lens":2,"lent":3,"less":1,"lest":3,"lets":1,"levy":3,"liar":2,"lice":3,"lick":3,"lids":4,"lied":2,"lien":3,"lies":1,"lieu":3,"life":1,"lift":1,"like":1,"lily":3,"limb":3,"lime":2,"limo":3,"limp":3,"line":1,"ling":3,"link":1,"lint":4,"lion":2,"lips":2,"list":1,"lite":3,"live":1,"load":1,"loaf":3,"loan":1,"lobe":3,"loch":3,"lock":1,"loco":3,"loft":3,"logo":2,"logs":2,"lone":2,"long":1,"look":1,"loom":3,"loon":4,"loop":2,"loot":3,"lord":1,"lore":3,"lose":1,"loss":1,"lost":1,"lots":1,"loud":1,"love":1,"lows":3,"luck":1,"lull":4,"lump":3,"lung":2,"lure":3,"lurk":4,"lush":3,"mace":3,"made":1,"maid":2,"mail":1,"main":1,"make":1,"male":1,"mall":2,"malt":3,"mama":2,"mane":3,"mans":3,"many":1,"maps":2,"mare":3,"mark":1,"mars":2,"mart":3,"mash":3,"mask":2,"mass":1,"mast":3,"mate":1,"math":2,"mats":3,"matt":3,"mayo":3,"maze":3,"mead":3,"meal":2,"mean":1,"meat":1,"meek":3,"meet":1,"melt":2,"memo":2,"mend":3,"mens":3,"menu":2,"meow":3,"mere":2,"mesa":3,"mesh":3,"mess":1,"meth":3,"mews":4,"mice":2,"midi":3,"mild":2,"mile":1,"milk":1,"mill":2,"mind":1,"mine":1,"ming":3,"mini":2,"mins":2,"mint":2,"mire":4,"miss":1,"mist":3,"mitt":3,"moan":3,"mobs":4,"mock":2,"mode":1,"mods":3,"mojo":3,"mold":3,"mole":3,"moms":2,"monk":2,"mono":3,"mood":2,"moon":1,"moor":3,"moot":3,"mops":4,"more":1,"moss":3,"most":1,"moth":3,"move":1,"much":1,"muck":4,"mugs":3,"mule":3,"mull":4,"mums":3,"muse":3,"musk":3,"must":1,"mute":3,"myth":2,"nags":4,"nail":2,"name":1,"napa":3,"nasa":2,"nato":2,"navy":1,"nazi":2,"near":1,"neat":2,"neck":1,"need":1,"neon":3,"nerd":3,"ness":3,"nest":2,"nets":2,"news":1,"newt":3,"next":1,"nice":1,"nick":3,"nigh":3,"nine":1,"node":2,"nods":3,"noel":3,"noes":4,"none":1,"nook":4,"noon":2,"nope":2,"norm":3,"nose":1,"note":1,"noun":3,"nova":3,"nude":2,"nuke":3,"null":3,"numb":3,"nuns":3,"nuts":2,"oaks":3,"oath":2,"oats":3,"obey":2,"odds":2,"odor":3,"offs":3,"oils":2,"oily":3,"okay":1,"olds":2,"omen":4,"omit":4,"once":1,"ones":1,"only":1,"onto":2,"opal":4,"open":1,"opus":4,"orbs":4,"ores":4,"orgy":3,"ours":2,"oust":4,"outs":2,"oval":2,"oven":2,"over":1,"owed":2,"owes":3,"owls":3,"owns":2,"pace":2,"pack":1,"pact":3,"pads":3,"page":1,"paid":1,"pain":1,"pair":1,"pale":2,"pall":4,"palm":2,"pals":3,"pang":4,"pans":3,"pant":4,"papa":2,"para":2,"pare":4,"park":1,"pars":4,"part":1,"pass":1,"past":1,"path":1,"pats":3,"pave":3,"pawn":3,"paws":3,"pays":2,"peak":1,"pear":3,"peas":3,"peat":3,"peck":3,"peek":3,"peel":2,"peep":3,"peer":2,"pelt":4,"pens":3,"perk":4,"pest":3,"pets":2,"pick":1,"pics":2,"pier":3,"pies":3,"pigs":2,"pike":3,"pile":2,"pill":2,"pimp":3,"pine":2,"ping":3,"pink":1,"pins":2,"pint":3,"pipe":2,"pith":4,"pits":3,"pity":2,"plan":1,"plat":4,"play":1,"plea":2,"pled":4,"plot":1,"plow":3,"ploy":3,"plug":2,"plum":3,"plus":1,"pods":3,"poem":2,"poet":2,"poke":3,"pole":2,"poll":2,"polo":3,"pond":2,"pong":3,"pony":2,"pool":1,"poop":3,"poor":1,"pope":2,"pops":2,"pore":3,"pork":2,"porn":1,"port":1,"pose":2,"posh":3,"post":1,"pots":3,"pour":2,"pray":2,"prep":2,"prey":2,"prod":3,"prof":2,"prom":3,"prop":3,"pros":2,"pubs":3,"puck":3,"puff":3,"puke":3,"pull":1,"pulp":3,"puma":3,"pump":2,"punk":2,"puns":4,"punt":3,"puny":4,"pups":3,"pure":1,"push":1,"puts":1,"quad":3,"quay":3,"quid":3,"quip":4,"quit":1,"quiz":2,"race":1,"rack":2,"raft":3,"rage":2,"rags":3,"raid":2,"rail":2,"rain":1,"raja":3,"rake":3,"ramp":2,"rams":3,"rang":3,"rank":2,"rant":3,"rape":2,"raps":4,"rare":1,"rash":3,"rate":1,"rats":2,"rave":3,"rays":2,"rbis":4,"read":1,"real":1,"reap":3,"rear":2,"reds":2,"reed":3,"reef":2,"reek":4,"reel":3,"refs":3,"rein":3,"rely":2,"rent":1,"reps":3,"rest":1,"revs":4,"ribs":2,"rice":2,"rich":1,"ride":1,"riff":3,"rift":3,"rigs":3,"rims":3,"ring":1,"rink":3,"riot":2,"ripe":3,"rips":3,"rise":1,"risk":1,"rite":3,"ritz":3,"road":1,"roam":3,"roar":3,"robe":3,"robs":4,"rock":1,"rode":2,"rods":3,"role":1,"roll":1,"rome":2,"romp":4,"roof":1,"room":1,"root":2,"rope":2,"rose":2,"rosy":3,"rout":4,"rove":4,"rows":2,"rubs":3,"ruby":3,"ruck":4,"rude":2,"rugs":4,"ruin":2,"rule":1,"rung":3,"runs":1,"rush":2,"rust":3,"sack":2,"safe":1,"saga":2,"sage":2,"said":1,"sail":2,"sake":2,"sale":1,"salt":1,"same":1,"sand":2,"sane":3,"sang":2,"sank":3,"saps":4,"sash":3,"save":1,"sawn":4,"saws":4,"says":1,"scab":4,"scam":2,"scan":2,"scar":3,"scum":3,"seal":2,"seam":3,"sear":4,"seas":2,"seat":1,"sect":3,"seed":2,"seek":1,"seem":1,"seen":1,"sees":1,"self":1,"sell":1,"semi":1,"send":1,"sent":1,"sept":2,"sera":4,"sets":1,"sewn":4,"sexy":2,"shah":2,"sham":3,"shan":3,"shed":2,"shia":3,"shin":3,"ship":1,"shoe":2,"shop":1,"shot":1,"show":1,"shun":3,"shut":1,"sick":1,"side":1,"sift":4,"sigh":2,"sign":1,"sikh":3,"silk":2,"sill":4,"sing":1,"sink":2,"sins":2,"sips":4,"sire":3,"site":1,"sits":2,"size":1,"skid":3,"skin":1,"skip":2,"skis":4,"skit":4,"slab":3,"slam":2,"slap":2,"slay":3,"sled":3,"slew":3,"slid":3,"slim":3,"slip":2,"slit":3,"slop":4,"slot":2,"slow":1,"slug":3,"slum":3,"smit":4,"smug":3,"snag":3,"snap":2,"snow":1,"snub":4,"soak":3,"soap":2,"soar":3,"sobs":4,"sock":3,"soda":2,"sofa":2,"soft":1,"soil":2,"sold":1,"sole":2,"soli":4,"solo":1,"soma":3,"some":1,"song":1,"sons":1,"soon":1,"sore":2,"sort":1,"soul":1,"soup":2,"sour":2,"sown":4,"sows":4,"spam":2,"span":2,"spat":3,"spec":3,"sped":3,"spin":2,"spit":2,"spot":1,"spun":3,"spur":3,"stab":3,"stag":3,"star":1,"stay":1,"stem":2,"step":1,"stew":3,"stir":2,"stop":1,"stow":4,"stub":4,"stud":3,"stun":3,"subs":3,"such":1,"suck":2,"sued":2,"sues":4,"suit":1,"sums":2,"sung":2,"sunk":3,"suns":3,"sure":1,"surf":2,"swab":4,"swag":4,"swam":3,"swan":2,"swap":2,"swat":3,"sway":3,"swig":4,"swim":2,"swum":4,"sync":2,"tabs":3,"tack":3,"taco":3,"tags":2,"tail":2,"take":1,"tale":2,"talk":1,"tall":1,"tame":3,"tang":3,"tank":1,"tans":4,"tape":2,"taps":3,"tars":4,"tart":3,"task":1,"taut":4,"taxi":2,"teal":3,"team":1,"tear":2,"teas":4,"tech":1,"teed":4,"teen":2,"tees":3,"tell":1,"temp":3,"tend":1,"tens":2,"tent":2,"term":1,"test":1,"text":1,"thai":2,"than":1,"that":1,"them":1,"then":1,"they":1,"thin":2,"this":1,"thou":2,"thug":3,"thus":1,"tick":2,"tide":2,"tidy":3,"tied":2,"tier":2,"ties":2,"tile":3,"till":1,"tilt":3,"time":1,"ting":3,"tins":4,"tint":3,"tiny":1,"tips":1,"tire":2,"toad":3,"toed":4,"toes":2,"tofu":3,"toil":4,"told":1,"toll":2,"tomb":2,"tone":2,"tons":2,"took":1,"tool":1,"tops":2,"tore":3,"torn":2,"toss":2,"tote":3,"tour":1,"town":1,"toys":2,"tram":3,"trap":2,"tray":3,"tree":1,"trek":2,"trim":2,"trio":2,"trip":1,"trod":4,"trot":3,"true":1,"tube":2,"tubs":4,"tuck":3,"tugs":4,"tuna":3,"tune":2,"turf":3,"turk":3,"turn":1,"twat":3,"twig":4,"twin":2,"twos":4,"type":1,"typo":3,"tyre":3,"ugly":2,"undo":3,"unit":1,"unix":3,"unto":3,"upon":1,"urdu":3,"urge":2,"used":1,"user":1,"uses":1,"vain":3,"vale":3,"vans":3,"vary":2,"vase":3,"vast":2,"veil":3,"vein":3,"vent":2,"verb":3,"very":1,"vest":3,"veto":3,"vets":3,"vibe":2,"vice":1,"view":1,"viii":3,"vile":3,"vine":3,"visa":2,"viva":3,"void":2,"volt":3,"vote":1,"vows":3,"wade":3,"wage":2,"wags":4,"wait":1,"wake":2,"walk":1,"wall":1,"wand":3,"wane":4,"want":1,"ward":2,"ware":3,"warm":1,"warn":2,"warp":3,"wars":1,"wart":4,"wary":3,"wash":2,"wasp":3,"watt":3,"wave":1,"wavy":3,"ways":1,"weak":1,"wear":1,"webs":4,"weed":2,"week":1,"weep":3,"weir":3,"weld":3,"well":1,"went":1,"wept":3,"were":1,"west":1,"what":1,"when":1,"whim":3,"whip":2,"whit":4,"whoa":3,"whom":2,"wick":3,"wide":1,"wife":1,"wigs":3,"wild":1,"will":3,"wily":4,"wind":1,"wine":1,"wing":1,"wink":3,"wins":1,"wipe":2,"wire":2,"wiry":4,"wise":1,"wish":1,"wisp":4,"with":1,"wits":3,"woes":3,"woke":2,"wolf":2,"womb":3,"wont":2,"wood":2,"wool":2,"word":1,"wore":2,"work":1,"worm":3,"worn":2,"wove":4,"wrap":2,"writ":3,"xiii":3,"xmas":3,"yang":2,"yard":2,"yarn":3,"yeah":1,"year":1,"yell":2,"yelp":3,"yoga":2,"yoke":4,"york":1,"your":1,"yuan":3,"zeal":3,"zero":1,"zest":4,"zinc":3,"zion":3,"zips":4,"zone":1,"zoom":2,"zoos":4},"5":{"abbey":3,"abbot":3,"abide":3,"abode":4,"abort":3,"about":1,"above":1,"abuse":1,"abyss":3,"ached":4,"aches":3,"acids":2,"acres":2,"acted":2,"actor":1,"acute":2,"adapt":2,"added":1,"adept":3,"adieu":4,"admin":3,"admit":1,"adobe":3,"adopt":2,"adore":3,"adorn":4,"adult":1,"aegis":4,"affix":4,"afoot":4,"after":1,"again":1,"agape":4,"agent":1,"agile":3,"aging":2,"agony":3,"agree":1,"ahead":1,"aided":3,"aides":3,"aimed":2,"aired":2,"aisle":3,"alarm":2,"album":1,"alert":2,"algae":3,"alias":3,"alien":2,"align":3,"alike":2,"alive":1,"alley":3,"allot":4,"allow":1,"alloy":3,"alone":1,"along":1,"aloof":4,"aloud":3,"alpha":2,"altar":2,"alter":2,"amaze":4,"amber":3,"amend":3,"amino":3,"amish":3,"amiss":4,"amity":4,"among":1,"ample":3,"amuse":4,"angel":2,"anger":2,"angle":2,"angry":1,"angst":3,"anime":2,"ankle":2,"annex":3,"annoy":3,"annum":3,"anode":4,"anvil":4,"aorta":4,"apart":1,"apple":1,"apply":1,"apron":3,"arabs":3,"arbor":3,"areas":1,"arena":2,"argon":4,"argue":2,"arise":2,"armed":1,"armor":2,"aroma":3,"arose":3,"array":2,"arrow":2,"arson":3,"aryan":3,"ashes":2,"aside":1,"asked":1,"aspen":3,"assay":3,"asses":3,"asset":2,"atlas":2,"atoms":3,"atone":4,"attic":3,"audio":2,"audit":2,"augur":4,"aunts":3,"autos":4,"avail":3,"avert":4,"avoid":1,"await":3,"awake":2,"award":1,"aware":1,"awful":2,"awoke":4,"axial":4,"axiom":4,"axles":4,"azure":3,"babes":3,"backs":2,"bacon":2,"bader":4,"badge":2,"badly":2,"bagel":4,"baggy":4,"baits":4,"baked":2,"baker":2,"bakes":4,"bales":4,"balls":1,"bands":2,"bandy":4,"bangs":3,"banjo":3,"banks":1,"barbs":4,"bared":4,"bares":4,"barge":3,"barks":4,"barns":4,"baron":3,"basal":3,"based":1,"bases":2,"basic":1,"basil":3,"basin":2,"basis":1,"batch":2,"bates":3,"bathe":3,"baths":3,"baton":3,"beach":1,"beads":3,"beams":3,"beans":2,"beard":2,"bears":2,"beast":2,"beats":2,"beech":3,"beers":2,"began":1,"begin":1,"begun":2,"beige":3,"being":1,"belle":3,"bells":2,"belly":2,"below":1,"belts":3,"bench":2,"bends":3,"berry":3,"berth":3,"beset":4,"bests":4,"betas":4,"bevel":4,"bible":1,"bikes":2,"bills":1,"binds":3,"binge":3,"bingo":3,"birch":3,"birds":1,"birth":1,"bison":3,"bitch":1,"bites":3,"black":1,"blade":2,"blame":1,"blanc":3,"bland":3,"blank":2,"blast":2,"blaze":3,"bleak":3,"bleed":3,"blend":2,"bless":2,"blind":1,"bling":4,"blink":3,"bliss":3,"blitz":3,"bloat":4,"block":1,"blogs":3,"bloke":3,"blond":3,"blood":1,"bloom":2,"blown":2,"blows":2,"blues":2,"bluff":3,"blunt":2,"blurs":4,"blush":3,"board":1,"boast":3,"boats":2,"bobby":3,"bogus":3,"boils":3,"bolts":3,"bombs":2,"bonds":2,"boned":4,"boner":3,"bones":2,"bonus":2,"boobs":2,"booed":4,"books":1,"booms":4,"boost":2,"booth":2,"boots":2,"booty":3,"booze":3,"bored":2,"bores":4,"borne":3,"bosom":4,"bound":2,"bouts":3,"bowed":3,"bowel":3,"bower":4,"bowls":3,"boxed":3,"boxer":3,"boxes":2,"brace":3,"brags":4,"braid":3,"brain":1,"brake":2,"brand":1,"brash":4,"brass":2,"brave":2,"bravo":3,"brawl":3,"bread":1,"break":1,"breed":2,"bribe":3,"brick":2,"bride":3,"brief":1,"bring":1,"brink":3,"brisk":3,"brits":3,"broad":1,"broil":4,"broke":1,"brood":3,"brook":3,"broom":3,"broth":3,"brown":1,"brows":3,"brush":2,"brute":3,"bucks":2,"buddy":2,"budge":3,"buffs":4,"buggy":3,"bugle":4,"build":1,"built":1,"bulbs":3,"bulge":3,"bulky":3,"bulls":2,"bully":2,"bumps":3,"bumpy":4,"bunch":1,"bunks":4,"bunny":3,"burly":4,"burns":2,"burnt":2,"burst":2,"buses":2,"bushy":4,"busts":4,"butts":3,"buyer":2,"bytes":3,"cabin":2,"cable":1,"cache":3,"cadet":3,"cadre":4,"cafes":3,"caged":4,"cages":3,"caked":4,"cakes":2,"calif":2,"calls":1,"calms":4,"camel":3,"cameo":3,"camps":2,"canal":2,"candy":2,"canes":4,"canoe":3,"canon":2,"caper":4,"capes":4,"cards":1,"cared":2,"cares":2,"cargo":2,"carol":3,"carry":2,"carts":3,"carve":3,"cased":4,"cases":1,"caste":3,"casts":3,"catch":1,"cater":3,"cause":1,"caved":4,"caves":3,"cease":2,"cedar":3,"cello":3,"cells":1,"cents":2,"chafe":4,"chaff":4,"chain":1,"chair":1,"chalk":3,"champ":2,"chant":3,"chaos":2,"chaps":4,"charm":2,"chart":2,"chase":2,"chats":3,"cheap":1,"cheat":2,"check":1,"cheek":2,"cheer":2,"chefs":3,"chess":2,"chest":1,"chews":4,"chick":2,"chief":1,"child":1,"chile":2,"chili":3,"chill":2,"china":3,"chins":4,"chips":2,"chirp":4,"chock":4,"choir":2,"choke":3,"chops":3,"chord":3,"chore":4,"chose":1,"chuck":2,"chump":4,"chunk":3,"churn":4,"chute":4,"cider":3,"cigar":3,"cinch":4,"circa":3,"cisco":3,"cited":2,"cites":3,"civic":2,"civil":1,"claim":1,"clamp":3,"clans":3,"claps":4,"clash":2,"clasp":4,"class":1,"claws":3,"clays":4,"clean":1,"clear":1,"cleft":4,"clerk":2,"click":1,"cliff":2,"climb":2,"cling":3,"clink":4,"clips":2,"cloak":3,"clock":2,"clogs":4,"clone":3,"close":1,"cloth":2,"clots":4,"cloud":2,"clout":3,"clove":4,"clown":2,"clubs":1,"clued":4,"clues":2,"clump":4,"clung":4,"coach":1,"coals":4,"coast":1,"coats":3,"cobra":3,"cocky":3,"cocoa":3,"coded":3,"codes":2,"coils":3,"coins":2,"colds":4,"colon":3,"color":1,"colts":3,"combo":2,"combs":4,"comer":4,"comes":1,"comet":3,"comfy":3,"comic":2,"comma":3,"condo":3,"cones":3,"congo":3,"cooks":3,"cools":4,"coped":4,"copes":4,"coral":3,"cords":3,"cores":3,"corks":4,"corns":4,"corny":4,"corps":2,"costs":1,"couch":2,"cough":2,"could":1,"count":1,"coupe":3,"coups":4,"court":1,"cover":1,"covet":4,"cowed":4,"crabs":3,"crack":2,"craft":2,"cramp":4,"crane":2,"crank":3,"crash":1,"crate":3,"crave":3,"crawl":3,"craze":3,"crazy":1,"cream":1,"creed":3,"creek":2,"creep":2,"crept":4,"crest":3,"crews":2,"cribs":4,"cried":2,"cries":2,"crime":1,"crisp":3,"croak":4,"crook":3,"crops":2,"crore":3,"cross":1,"crowd":1,"crown":1,"crows":3,"crude":2,"cruel":2,"crush":2,"crust":3,"cuban":2,"cubed":4,"cubes":3,"cubic":3,"cuffs":3,"cults":4,"cunts":3,"cupid":3,"curbs":4,"cured":3,"cures":3,"curls":3,"curly":3,"curry":2,"curse":2,"curve":2,"cuter":4,"cutie":3,"cycle":1,"cynic":4,"cysts":4,"czech":2,"daddy":2,"daily":1,"dairy":2,"daisy":3,"dance":1,"dandy":3,"danes":3,"dared":3,"dares":3,"darts":3,"dated":2,"dates":1,"dawns":4,"dazed":4,"deals":1,"dealt":2,"deans":4,"dears":4,"death":1,"debit":3,"debts":2,"debut":1,"decay":2,"decks":3,"decor":3,"deeds":3,"deems":4,"defer":3,"deity":3,"delay":2,"delta":2,"delve":4,"demon":2,"demos":3,"denim":3,"dense":2,"dents":4,"depot":2,"depth":1,"derby":2,"desks":3,"deter":3,"devil":2,"dials":4,"diary":2,"diced":4,"dicks":3,"diets":3,"digit":3,"dildo":3,"dimes":4,"dimly":4,"dined":4,"diner":3,"dingy":4,"dirty":1,"disco":3,"discs":3,"disks":3,"ditch":2,"ditto":3,"divan":4,"dived":4,"diver":3,"dives":3,"dizzy":3,"docks":3,"dodge":2,"dodgy":3,"doggy":3,"dogma":3,"doing":1,"dolls":2,"donor":2,"donut":3,"doors":1,"dosed":4,"doses":3,"doubt":1,"dough":2,"doves":4,"downs":2,"dowry":4,"dozen":2,"draft":1,"drags":3,"drain":2,"drake":3,"drama":1,"drank":2,"drawn":1,"draws":2,"dread":3,"dream":1,"dress":1,"dried":2,"drier":4,"dries":3,"drift":2,"drill":2,"drink":1,"drips":4,"drive":1,"drone":2,"droop":4,"drops":2,"drove":2,"drown":3,"drugs":1,"drums":2,"drunk":1,"dryer":3,"ducks":2,"ducts":4,"dudes":2,"duels":4,"dukes":3,"dummy":3,"dumps":3,"dunes":3,"dunks":4,"duped":4,"dusky":4,"dusty":3,"dutch":2,"dwarf":3,"dwell":3,"dwelt":4,"dying":1,"eager":2,"eagle":2,"eared":4,"earls":4,"early":1,"earns":3,"earth":1,"eased":3,"eases":4,"eaten":2,"eater":3,"ebony":3,"edema":4,"edged":3,"edges":2,"edits":3,"eerie":3,"egged":4,"eight":1,"eject":4,"elbow":2,"elder":2,"elect":2,"elite":2,"elude":4,"elves":3,"email":1,"embed":4,"emits":4,"empty":1,"enact":3,"ended":1,"enemy":1,"enjoy":1,"ensue":4,"enter":1,"entry":1,"envoy":3,"epics":4,"epoch":4,"epoxy":4,"equal":1,"equip":3,"erase":3,"erect":3,"erode":4,"erred":4,"error":1,"erupt":4,"essay":2,"ether":3,"ethic":3,"ethos":3,"euros":3,"evade":3,"evens":4,"event":1,"every":1,"evils":3,"evoke":3,"exact":1,"exalt":4,"exams":2,"excel":3,"exert":3,"exile":2,"exist":1,"exits":3,"expel":3,"extra":1,"faced":2,"faces":1,"facet":4,"facts":1,"faded":3,"fades":3,"fails":2,"faint":3,"fairs":3,"fairy":2,"faith":2,"faked":3,"faker":4,"fakes":3,"falls":1,"false":1,"famed":3,"fancy":2,"farce":3,"fared":4,"fares":3,"farms":2,"fasts":4,"fatal":2,"fated":4,"fates":4,"fatty":2,"fault":1,"fauna":3,"favor":1,"fears":2,"feast":2,"feats":3,"feces":3,"feeds":2,"feels":1,"fella":3,"fells":4,"felon":4,"fence":2,"feral":3,"ferry":2,"fetal":3,"fetch":3,"fetus":3,"fever":2,"fewer":2,"fiber":2,"fibre":3,"field":1,"fiend":4,"fiery":3,"fifth":1,"fifty":2,"fight":1,"filed":2,"files":2,"fills":3,"films":1,"filth":3,"final":1,"finch":3,"finds":1,"fined":3,"finer":3,"fines":3,"fired":1,"fires":2,"firms":2,"first":1,"fishy":3,"fists":3,"fitch":3,"fiver":4,"fixed":1,"fixer":4,"fixes":3,"flags":2,"flail":4,"flair":3,"flake":3,"flame":2,"flank":3,"flaps":3,"flare":3,"flash":2,"flask":3,"flats":3,"flaws":2,"fleck":4,"flees":4,"fleet":2,"flesh":2,"flick":3,"flies":2,"fling":3,"flint":3,"flips":3,"flirt":3,"float":2,"flock":3,"flood":2,"floor":1,"flops":3,"flora":3,"flour":2,"flown":2,"flows":2,"fluff":3,"fluid":2,"flung":3,"flush":2,"flute":3,"flyer":3,"foams":4,"focal":3,"focus":1,"foils":4,"folds":3,"folks":1,"folly":3,"fonts":3,"foods":2,"fools":2,"force":1,"forge":3,"forgo":4,"forks":3,"forms":1,"forte":3,"forth":2,"forts":3,"forty":2,"forum":2,"found":1,"fours":3,"foxes":3,"foyer":4,"frail":3,"frame":1,"frank":2,"fraud":2,"freak":2,"freed":2,"freer":4,"frees":4,"fresh":1,"frets":4,"fried":2,"fries":2,"frogs":3,"front":1,"frost":2,"froth":4,"frown":3,"froze":3,"fruit":1,"fucks":2,"fudge":3,"fuels":2,"fully":1,"fumes":3,"funds":1,"fungi":3,"funky":3,"funny":1,"furry":3,"fused":3,"fuses":4,"fussy":4,"fuzzy":3,"gable":4,"gains":2,"gamer":3,"games":1,"gamma":3,"gamut":4,"gangs":3,"gases":3,"gasps":4,"gated":3,"gates":2,"gator":4,"gaudy":4,"gauge":2,"gaunt":4,"gauss":4,"gazed":4,"gears":3,"geeks":3,"geese":3,"gemma":3,"genes":2,"genie":3,"genre":2,"genus":3,"germs":3,"ghost":2,"ghoul":4,"giant":1,"giddy":3,"gifts":2,"girls":1,"given":1,"giver":3,"gives":1,"gland":3,"glare":3,"glass":1,"glaze":3,"gleam":4,"glide":3,"glint":4,"gloat":4,"globe":2,"gloom":3,"glory":2,"gloss":3,"glove":3,"glows":4,"glued":3,"glues":4,"gnome":3,"goals":1,"goats":3,"godly":3,"going":1,"golds":4,"gonna":1,"goods":1,"goofy":3,"goons":3,"goose":3,"gorge":3,"gouge":4,"gourd":4,"gowns":3,"grabs":3,"grace":2,"grade":1,"graft":3,"grail":3,"grain":2,"grams":2,"grand":1,"grant":2,"grape":3,"graph":2,"grasp":2,"grass":2,"grate":4,"grave":2,"gravy":3,"graze":4,"great":1,"greed":3,"green":1,"greet":3,"greys":4,"grief":2,"grill":2,"grind":2,"grins":4,"grips":3,"groan":4,"groin":3,"groom":3,"gross":2,"group":1,"grove":3,"growl":4,"grown":1,"grows":2,"gruff":4,"grunt":4,"guard":1,"guess":1,"guest":1,"guide":1,"guild":2,"guilt":2,"guise":3,"gulls":4,"gummy":4,"gurus":4,"gusto":4,"habit":2,"hacks":3,"hades":3,"haiku":4,"hails":4,"hairs":3,"hairy":2,"halls":2,"halos":4,"halts":4,"hands":1,"handy":2,"hangs":3,"hanks":3,"happy":1,"hardy":2,"harem":4,"hares":4,"harms":3,"harps":4,"harsh":2,"haste":3,"hasty":3,"hatch":2,"hated":2,"hater":4,"hates":2,"hauls":4,"haunt":3,"haven":2,"havoc":3,"hawks":2,"heads":1,"heals":3,"heaps":3,"heard":1,"hears":3,"heart":1,"heath":3,"heats":3,"heave":4,"heavy":1,"hedge":3,"heels":2,"hefty":3,"heirs":3,"heist":3,"helix":3,"hello":1,"helms":4,"helps":1,"hence":2,"herbs":3,"herds":3,"heres":4,"heros":4,"hicks":3,"hides":3,"highs":3,"hiked":4,"hikes":3,"hills":2,"hindi":2,"hindu":2,"hinge":3,"hints":2,"hired":2,"hires":3,"hitch":3,"hives":4,"hoard":3,"hobby":2,"hoist":4,"holds":1,"holes":2,"holly":3,"homes":1,"honey":2,"hooks":3,"hoops":3,"hoots":4,"hoped":2,"hopes":2,"horde":3,"horns":2,"horny":3,"horse":1,"hosts":2,"hotel":1,"hound":3,"hours":1,"house":1,"hover":3,"howls":4,"hubby":3,"human":1,"humid":3,"humor":2,"hunch":4,"hunts":3,"hurry":2,"hurts":2,"husky":3,"hydra":3,"hymns":3,"hyped":3,"hyper":3,"icing":3,"icons":3,"ideal":2,"ideas":1,"idiom":4,"idiot":2,"idols":3,"image":1,"imply":2,"inbox":3,"incur":3,"index":1,"inept":4,"inert":4,"infer":4,"inked":4,"inlay":4,"inlet":3,"inner":1,"input":2,"inset":4,"inter":2,"intro":2,"ionic":3,"iraqi":2,"irons":3,"irony":2,"islam":2,"issue":1,"itchy":3,"items":1,"ivory":3,"jacks":3,"jaded":4,"jails":3,"japan":1,"jazzy":4,"jeans":2,"jelly":3,"jerks":3,"jewel":3,"jihad":3,"jimmy":3,"johns":2,"joins":2,"joint":1,"joked":3,"joker":3,"jokes":2,"jolly":3,"judge":1,"juice":2,"juicy":3,"jumbo":3,"jumps":2,"junta":3,"juror":4,"kappa":3,"karma":2,"kayak":3,"keeps":1,"keyed":4,"khaki":4,"kicks":2,"kills":2,"kilos":3,"kinda":2,"kinds":1,"kings":2,"kinky":3,"kitty":3,"knack":3,"kneel":3,"knees":2,"knelt":4,"knife":2,"knits":4,"knock":2,"knoll":4,"knots":3,"known":1,"knows":1,"kraft":3,"kudos":3,"label":2,"labor":1,"laced":3,"laces":4,"lacks":2,"laden":3,"lager":4,"lakes":2,"lambs":3,"lamps":3,"lance":3,"lands":2,"lanes":2,"lapse":3,"large":1,"laser":2,"lasts":2,"latch":3,"later":1,"latex":3,"latin":2,"latte":3,"laugh":1,"lawns":3,"layed":4,"layer":2,"leach":3,"leads":1,"leafs":3,"leafy":3,"leaks":2,"leans":3,"leant":4,"leaps":3,"leapt":4,"learn":1,"lease":2,"leash":3,"least":1,"leave":1,"ledge":3,"leech":4,"lefty":3,"legal":1,"legit":3,"lemma":4,"lemon":2,"lends":3,"level":1,"lever":3,"liars":3,"libel":3,"licks":4,"lifes":4,"lifts":3,"light":1,"liked":1,"likes":1,"lilac":4,"limbo":3,"limbs":3,"limit":1,"lined":2,"linen":3,"liner":3,"lines":1,"links":1,"lions":2,"lipid":3,"lists":2,"liter":3,"litre":3,"lived":1,"liver":2,"lives":1,"livid":4,"loads":2,"loans":1,"lobby":2,"lobed":4,"lobes":4,"local":1,"locks":2,"locus":4,"lodge":2,"lofts":4,"lofty":3,"logic":2,"login":3,"logos":3,"longs":4,"looks":1,"looms":3,"loons":4,"loops":3,"loose":2,"lopes":4,"lords":2,"loser":2,"loses":2,"lotto":3,"lotus":3,"louse":4,"lousy":3,"loved":1,"lover":2,"loves":1,"lower":1,"lowly":3,"loyal":2,"lucid":3,"lucky":2,"lumps":4,"lunar":3,"lunch":1,"lunge":4,"lungs":2,"lupus":3,"lurch":4,"lured":3,"lures":4,"lurid":4,"lurks":4,"lying":1,"lymph":3,"lynch":2,"lyric":3,"macho":3,"macro":3,"madam":3,"madly":4,"mafia":2,"magic":1,"magma":4,"maids":3,"mails":3,"mains":3,"maize":3,"major":1,"maker":2,"makes":1,"malay":3,"males":2,"malik":3,"malls":3,"mamma":3,"manes":4,"mango":3,"mania":3,"manic":3,"manly":3,"manor":2,"maori":3,"maple":2,"march":1,"mares":4,"marks":2,"marry":2,"marsh":3,"masks":2,"mason":2,"masts":4,"match":1,"mater":3,"mates":2,"maths":3,"matte":3,"maxim":3,"maybe":1,"mayor":2,"meals":2,"means":1,"meant":1,"meats":3,"meaty":4,"mecca":3,"medal":2,"media":1,"medic":3,"meets":2,"melee":3,"melon":3,"melts":3,"menus":3,"mercy":2,"merge":3,"merit":2,"merry":3,"messy":2,"metal":1,"meter":2,"metre":3,"metro":2,"miami":2,"micro":2,"midst":2,"might":1,"milks":4,"milky":3,"mills":2,"mimic":3,"mince":4,"minds":2,"mined":3,"miner":3,"mines":2,"minor":1,"mints":4,"minus":2,"mired":4,"mists":4,"misty":3,"mites":4,"mixed":1,"mixer":3,"mixes":3,"moans":4,"mocks":4,"modal":4,"model":1,"modem":3,"modes":2,"moist":3,"momma":3,"money":1,"monks":3,"month":1,"moods":3,"moody":3,"moons":3,"moose":3,"moral":2,"mores":4,"moron":3,"motel":3,"moths":3,"motif":3,"motor":1,"motto":3,"mould":3,"mound":3,"mount":2,"mourn":3,"mouse":2,"mouth":1,"moved":1,"mover":3,"moves":1,"movie":1,"mowed":4,"mucus":4,"muddy":3,"mulch":4,"mules":4,"mummy":3,"mural":3,"murky":4,"mused":4,"muses":4,"music":1,"muted":3,"mutes":4,"myths":3,"nails":2,"naive":3,"naked":2,"named":1,"names":1,"nanny":3,"nasal":3,"nasty":2,"natal":3,"naval":2,"navel":4,"nazis":2,"nears":4,"necks":3,"needs":1,"needy":3,"negro":3,"nerds":3,"nerve":2,"nests":3,"never":1,"newer":2,"newly":2,"nexus":3,"nicer":3,"niche":2,"niece":2,"night":1,"nines":4,"ninja":2,"ninth":2,"noble":2,"nodes":3,"noise":1,"noisy":3,"norms":3,"norse":3,"north":1,"nosed":4,"noses":3,"notch":3,"noted":1,"notes":1,"nouns":3,"novel":1,"nudes":3,"nudge":3,"nurse":2,"nutty":4,"nylon":3,"nymph":4,"oasis":3,"obese":3,"occur":2,"ocean":1,"oddly":3,"offer":1,"often":1,"oiled":4,"older":1,"olive":3,"omaha":3,"omega":3,"omens":4,"onion":2,"onset":3,"opens":2,"opera":2,"opium":3,"opted":3,"optic":3,"orbit":2,"order":1,"organ":2,"other":1,"otter":3,"ought":2,"ounce":2,"outed":4,"outer":2,"ovens":3,"overs":3,"overt":3,"owing":3,"owned":1,"owner":1,"oxide":3,"ozone":3,"paced":3,"packs":2,"pagan":3,"paged":4,"pages":1,"pains":2,"paint":1,"pairs":2,"paler":4,"pales":4,"palms":3,"palsy":3,"panda":3,"panel":1,"panes":4,"pangs":4,"panic":2,"pants":2,"papal":3,"paper":1,"papua":3,"pared":4,"parks":2,"parry":3,"parts":1,"party":1,"pasta":2,"paste":2,"pasts":4,"patch":2,"paths":2,"patio":3,"pause":2,"paved":3,"payed":4,"payer":3,"peace":1,"peach":3,"peaks":2,"pearl":2,"pears":4,"pease":4,"pedal":3,"peels":4,"peeps":4,"peers":2,"pelts":4,"penal":3,"pence":3,"penis":2,"penny":3,"pepsi":3,"perch":3,"peril":3,"perks":3,"perky":4,"pesos":3,"pests":3,"petty":2,"phase":1,"phone":1,"phony":3,"photo":1,"piano":2,"picks":2,"picky":3,"piece":1,"piers":3,"piggy":3,"pikes":4,"piled":3,"piles":3,"pills":2,"pilot":1,"pinch":3,"pines":3,"pings":4,"pinks":4,"pinky":3,"pints":3,"pious":3,"piped":4,"piper":3,"pipes":2,"pique":4,"pitch":2,"pivot":3,"pixel":3,"pixie":4,"pizza":2,"place":1,"plaid":3,"plain":2,"plane":1,"plank":3,"plans":1,"plant":1,"plate":1,"plays":1,"plaza":2,"plead":3,"pleas":3,"plied":4,"plies":4,"plots":3,"pluck":4,"plugs":3,"plumb":4,"plume":4,"plump":4,"plums":4,"plush":3,"poems":2,"poets":2,"point":1,"poise":4,"poked":3,"poker":2,"pokes":4,"polar":2,"poles":2,"polio":3,"polka":3,"polls":2,"ponds":3,"pools":2,"popes":4,"poppy":3,"porch":2,"pores":3,"porno":3,"ports":2,"posed":2,"poses":3,"posts":1,"potty":3,"pouch":3,"pound":2,"pours":3,"power":1,"prank":3,"prays":4,"press":1,"preys":4,"price":1,"prick":3,"pride":2,"prima":3,"prime":1,"print":1,"prior":1,"prise":4,"prism":3,"privy":3,"prize":1,"probe":2,"prone":2,"proof":1,"props":3,"prose":3,"proto":3,"proud":1,"prove":1,"prowl":4,"proxy":3,"psalm":3,"puffs":4,"pulls":2,"pulse":2,"pumps":2,"punch":2,"punts":4,"pupil":2,"puppy":2,"purer":4,"purge":3,"purse":2,"pussy":2,"putts":4,"quack":4,"quail":4,"quake":3,"quart":4,"quasi":3,"queen":1,"queer":3,"quell":4,"query":3,"quest":2,"queue":3,"quick":1,"quiet":1,"quill":4,"quilt":3,"quips":4,"quirk":4,"quite":1,"quits":3,"quota":3,"quote":1,"rabbi":3,"raced":3,"racer":3,"races":2,"racks":3,"radar":2,"radii":4,"radio":1,"rafts":4,"raged":4,"rages":4,"raids":2,"rails":3,"rains":2,"rainy":3,"raise":1,"raked":4,"rakes":4,"rally":2,"ramps":3,"ranch":2,"range":1,"ranks":2,"raped":2,"rapes":3,"rapid":2,"rarer":4,"rated":2,"rates":1,"ratio":2,"raven":3,"rayed":4,"razor":3,"reach":1,"react":2,"reads":2,"ready":1,"realm":2,"rears":4,"rebel":2,"recap":3,"recur":4,"reefs":3,"reeks":4,"reels":4,"refer":2,"regal":3,"reich":3,"reign":2,"reins":3,"relax":2,"relay":2,"relic":3,"remit":4,"remix":3,"renal":3,"renew":3,"rents":3,"repay":3,"repel":3,"reply":1,"rerun":4,"reset":2,"resin":3,"rests":3,"retro":3,"reuse":3,"revel":4,"rhino":3,"rhyme":3,"rider":2,"rides":2,"ridge":2,"rifle":2,"rifts":4,"right":1,"rigid":3,"rings":2,"rinse":3,"riots":2,"risen":2,"rises":2,"risks":2,"risky":2,"rites":3,"rival":2,"river":1,"rivet":4,"roach":3,"roads":1,"roars":4,"roast":2,"robed":4,"robes":3,"robin":2,"robot":2,"rocks":2,"rocky":2,"rodeo":3,"rogue":2,"roles":2,"rolls":2,"roman":3,"roofs":3,"rooms":1,"roost":4,"roots":2,"roped":4,"ropes":3,"roses":2,"rotor":3,"rouge":3,"rough":2,"round":1,"rouse":4,"route":1,"rover":3,"rowan":3,"rowdy":3,"rowed":4,"royal":2,"ruddy":4,"rugby":2,"ruins":2,"ruled":2,"ruler":2,"rules":1,"rumor":3,"runes":4,"rural":1,"rusty":3,"sable":4,"sacks":3,"sadly":2,"safer":2,"safes":4,"sager":4,"sages":4,"sails":3,"saint":2,"sakes":4,"salad":2,"sales":1,"sally":3,"salon":2,"salsa":3,"salts":3,"salty":3,"salve":4,"sands":2,"sandy":2,"sassy":3,"satin":3,"sauce":2,"saudi":2,"sauna":3,"saute":4,"saved":1,"saver":3,"saves":2,"savvy":3,"sawed":4,"scabs":4,"scale":1,"scalp":3,"scams":3,"scans":3,"scant":4,"scare":2,"scarf":3,"scars":3,"scary":2,"scene":1,"scent":2,"scoff":4,"scold":4,"scoop":3,"scope":2,"score":1,"scorn":4,"scots":3,"scour":4,"scout":2,"scrap":2,"screw":2,"scrub":3,"scrum":3,"scuba":3,"scuff":4,"seals":2,"seams":3,"sears":3,"seats":1,"sects":4,"sedan":3,"seeds":2,"seeks":2,"seems":1,"seers":4,"seize":2,"sells":2,"semen":3,"sends":2,"sense":1,"sepia":4,"serum":3,"serve":1,"setup":2,"seven":1,"sewed":4,"sewer":3,"sexes":3,"shack":3,"shade":2,"shady":3,"shaft":2,"shake":2,"shaky":3,"shale":3,"shall":1,"shame":1,"shams":4,"shape":1,"shard":4,"share":1,"shark":2,"sharp":2,"shave":2,"shawl":4,"shear":3,"sheds":3,"sheen":3,"sheep":2,"sheer":2,"sheet":2,"shelf":2,"shell":2,"shied":4,"shift":1,"shine":2,"shins":4,"shiny":2,"ships":1,"shire":3,"shirt":1,"shits":3,"shiva":3,"shock":2,"shoes":1,"shone":3,"shook":2,"shoot":1,"shops":2,"shore":2,"short":1,"shots":1,"shout":2,"shove":3,"shown":1,"shows":1,"showy":4,"shred":3,"shrub":4,"shrug":3,"shunt":4,"shuts":3,"sided":2,"sides":1,"siege":2,"sieve":4,"sighs":3,"sight":1,"sigma":3,"signs":1,"silky":3,"silly":2,"silos":4,"since":1,"singe":4,"sings":2,"sinks":3,"sinus":3,"siren":3,"sited":4,"sites":1,"sixes":4,"sixth":2,"sixty":2,"sized":2,"sizes":2,"skate":3,"skids":4,"skier":3,"skies":2,"skill":2,"skins":3,"skips":4,"skirt":2,"skits":4,"skull":2,"skunk":4,"slabs":3,"slack":3,"slain":3,"slams":3,"slang":3,"slaps":4,"slash":3,"slate":2,"slats":4,"slave":2,"sleek":3,"sleep":1,"slept":2,"slice":2,"slick":3,"slide":2,"slime":3,"sling":3,"slips":3,"sloop":4,"slope":2,"slots":2,"slows":3,"slugs":4,"slump":3,"slums":3,"slung":4,"smack":3,"small":1,"smart":1,"smash":2,"smear":3,"smell":2,"smile":1,"smirk":4,"smite":4,"smoke":1,"smoky":3,"snack":2,"snags":4,"snail":3,"snake":2,"snaps":3,"snare":3,"snarl":4,"sneak":2,"sneer":4,"sniff":3,"snoop":3,"snore":4,"snort":4,"snows":4,"snowy":3,"snuck":3,"soaks":4,"soaps":4,"soars":4,"sober":2,"socks":2,"sofas":4,"soils":3,"solar":1,"soles":4,"solid":1,"solos":3,"solve":2,"sonar":3,"songs":1,"sonic":2,"sores":4,"sorry":1,"sorts":2,"souls":2,"sound":1,"soups":4,"south":1,"sowed":4,"space":1,"spade":3,"spans":3,"spare":2,"spark":2,"spasm":4,"spawn":3,"speak":1,"spear":3,"speck":4,"specs":3,"speed":1,"spell":2,"spelt":4,"spend":1,"spent":1,"sperm":2,"spice":2,"spicy":2,"spied":4,"spies":3,"spike":3,"spill":2,"spilt":4,"spine":2,"spins":3,"spire":4,"spite":2,"spits":4,"split":1,"spoil":2,"spoke":1,"spoon":2,"sport":1,"spots":2,"spout":4,"spray":2,"spree":3,"spurs":2,"squad":1,"squat":3,"squid":3,"stack":2,"staff":1,"stage":1,"stain":3,"stair":3,"stake":2,"stale":3,"stalk":3,"stall":3,"stamp":2,"stand":1,"stank":4,"stare":2,"stark":2,"stars":1,"start":1,"stash":3,"state":1,"stays":2,"stead":4,"steak":2,"steal":2,"steam":1,"steel":1,"steep":2,"steer":3,"stein":3,"stems":2,"steps":1,"stern":3,"stick":1,"stiff":2,"still":1,"sting":3,"stink":3,"stint":3,"stirs":4,"stock":1,"stoic":4,"stoke":3,"stole":2,"stomp":3,"stone":1,"stony":3,"stood":1,"stool":3,"stoop":4,"stops":2,"store":1,"storm":2,"story":1,"stout":3,"stove":3,"strap":3,"straw":2,"stray":3,"strip":2,"strut":4,"stubs":4,"stuck":1,"studs":3,"study":1,"stuff":1,"stump":3,"stung":3,"stuns":4,"stunt":2,"style":1,"suave":4,"sucks":2,"suede":3,"sugar":1,"suing":3,"suite":2,"suits":2,"sunni":3,"sunny":3,"super":1,"supra":4,"surge":2,"surly":4,"sushi":3,"swabs":4,"swami":4,"swamp":2,"swans":3,"swaps":4,"swarm":3,"sways":4,"swear":1,"sweat":2,"sweep":2,"sweet":1,"swell":3,"swept":2,"swift":2,"swims":4,"swine":3,"swing":2,"swipe":3,"swirl":4,"swish":4,"swiss":2,"swoon":4,"swoop":3,"sword":2,"swore":3,"sworn":2,"swung":3,"synod":3,"syrup":3,"table":1,"taboo":3,"tacks":4,"tacos":3,"tails":3,"taint":4,"taken":1,"taker":3,"takes":1,"takin":3,"tales":2,"talks":1,"tally":3,"tamed":4,"tamil":3,"tango":3,"tanks":2,"taped":3,"taper":3,"tapes":2,"tarry":4,"tasks":2,"taste":1,"tasty":2,"taunt":4,"taxed":3,"taxes":1,"taxis":3,"teach":1,"teams":1,"tears":2,"tease":3,"teens":2,"teeth":1,"tells":1,"telly":3,"tempo":3,"temps":3,"tempt":3,"tends":2,"tenet":4,"tenor":3,"tense":2,"tenth":2,"tents":3,"terms":1,"tesla":3,"tests":1,"texts":2,"thank":1,"theft":2,"their":1,"theme":1,"there":1,"these":1,"thick":2,"thief":2,"thigh":3,"thine":3,"thing":1,"think":1,"thins":4,"third":1,"thorn":3,"those":1,"three":1,"threw":2,"throb":4,"throw":1,"thugs":3,"thumb":2,"thump":4,"ticks":3,"tidal":3,"tides":3,"tiers":3,"tiger":2,"tight":1,"tiled":4,"tiles":3,"tilts":4,"timed":3,"timer":3,"times":1,"timid":3,"tipsy":4,"tired":1,"tires":2,"titan":3,"title":1,"toast":2,"today":1,"token":2,"tolls":3,"tombs":3,"tonal":4,"toned":3,"tones":3,"tonic":3,"tonne":3,"tools":1,"tooth":2,"topic":2,"torah":3,"torch":3,"torso":3,"total":1,"touch":1,"tough":1,"tours":2,"towed":3,"towel":2,"tower":1,"towns":2,"toxic":2,"toxin":3,"toyed":4,"trace":2,"track":1,"tract":3,"trade":1,"trail":2,"train":1,"trait":3,"tramp":3,"traps":3,"trash":2,"trays":3,"tread":3,"treat":1,"trees":1,"trend":1,"triad":3,"trial":1,"tribe":2,"trick":2,"tried":1,"tries":1,"trill":4,"trims":4,"trios":4,"trips":2,"trite":4,"troll":3,"troop":3,"trots":4,"trout":3,"truce":3,"truck":1,"truer":4,"truly":1,"trump":1,"trunk":2,"truss":3,"trust":1,"truth":1,"tubes":2,"tucks":4,"tufts":4,"tummy":3,"tumor":2,"tuned":2,"tunes":2,"turbo":3,"turks":3,"turns":1,"tutor":3,"twain":3,"tweak":3,"tweed":3,"tweet":2,"twice":1,"twigs":4,"twine":4,"twins":2,"twirl":4,"twist":2,"tying":3,"typed":3,"types":1,"tyres":3,"ulcer":4,"ultra":2,"uncle":2,"uncut":3,"under":1,"undid":4,"undue":3,"unfit":3,"unify":4,"union":1,"unite":2,"units":1,"unity":2,"until":1,"upped":4,"upper":1,"upset":1,"urban":2,"urged":2,"urges":3,"urine":2,"usage":2,"users":1,"usher":3,"using":1,"usual":1,"utter":2,"vague":2,"valet":4,"valid":2,"valor":3,"value":1,"valve":2,"vapor":3,"vases":4,"vault":2,"vegan":2,"veils":4,"veins":3,"venom":3,"vents":3,"venue":2,"verbs":3,"verge":3,"verse":2,"verve":4,"vests":4,"vexed":4,"vibes":3,"vicar":3,"vices":4,"video":1,"views":1,"vigil":3,"villa":2,"vines":3,"vinyl":2,"viola":3,"viper":3,"viral":2,"virus":2,"visas":3,"visit":1,"vista":3,"vital":2,"vivid":3,"vocal":2,"vodka":2,"vogue":3,"voice":1,"voids":4,"volts":3,"vomit":3,"voted":1,"voter":2,"votes":1,"vouch":4,"vowed":3,"vowel":3,"vying":4,"wacky":3,"wafer":4,"waged":3,"wager":3,"wages":2,"wagon":2,"wails":4,"waist":2,"waits":3,"waive":3,"wakes":3,"walks":2,"walls":1,"waltz":3,"wands":4,"waned":4,"wanna":1,"wants":1,"wards":3,"warms":4,"warns":3,"warps":4,"warts":4,"wasps":3,"waste":1,"watch":1,"water":1,"watts":3,"waved":3,"waver":4,"waves":2,"waxed":4,"waxes":4,"wears":2,"weary":3,"weave":3,"wedge":3,"weeds":3,"weeks":1,"weigh":2,"weird":1,"welds":4,"wells":2,"wests":4,"whack":3,"whale":2,"wharf":3,"wheat":2,"wheel":1,"where":1,"which":1,"whiff":3,"while":1,"whims":4,"whine":3,"whips":4,"whirl":4,"whisk":4,"white":1,"whole":1,"whoop":3,"whore":2,"whorl":4,"whose":1,"widen":3,"wider":2,"widow":2,"width":2,"wield":3,"wight":3,"wilds":4,"wills":3,"wince":4,"winds":2,"windy":3,"wines":2,"wings":2,"winks":4,"wiped":2,"wipes":3,"wired":2,"wires":2,"wiser":3,"wisps":4,"witch":2,"witty":3,"wives":2,"woken":3,"woman":1,"women":1,"woods":2,"woody":3,"words":1,"works":1,"world":1,"worms":3,"worry":1,"worse":1,"worst":1,"worth":1,"would":1,"wound":2,"woven":3,"wraps":3,"wrath":3,"wreak":4,"wreck":2,"wring":4,"wrist":2,"write":1,"wrong":1,"wrote":1,"xenon":4,"yacht":2,"yahoo":2,"yards":1,"yawns":4,"yearn":4,"years":1,"yeast":3,"yells":3,"yield":2,"young":1,"yours":2,"youth":1,"yummy":3,"zebra":3,"zeros":4,"zoned":4,"zones":2,"zooms":4}};
// ---- Digi Puzzles engine: seeded RNG, backtracking filler, validator ----
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const PATTERNS={
 corners:["#...#",".....",".....",".....","#...#"],
 wings:  [".#...",".....",".....",".....","...#."],
 steps:  ["#....",".....",".....",".....","....#"],
 frame:  ["....#",".....",".....",".....","#...."],
 open:   [".....",".....",".....",".....","....."],
};
// Tier 4 = rare (added 2026-10-17): capped per band, and every letter of a rare
// word must sit in a common (tier 1-2) crossing word.
const BANDS={
 easy:  {pool:[1,2],     maxT3:0,  maxT4:0, maxMean:2.05, bias:{1:8,2:2,3:0,4:0}},
 medium:{pool:[1,2,3,4], maxT3:2,  maxT4:1, maxMean:2.45, bias:{1:4,2:3,3:1,4:0.5}},
 hard:  {pool:[1,2,3,4], maxT3:99, maxT4:3, maxMean:9.9,  bias:{1:2,2:3,3:3,4:2}},
};
const tierOf=w=>WORDS[String(w.length)][w];

function findSlots(grid){
  const slots=[];
  for(let r=0;r<5;r++){let c=0;while(c<5){if(grid[r][c]==="#"){c++;continue;}let s=c;while(c<5&&grid[r][c]!=="#")c++;const L=c-s;if(L===2)return null;if(L>=3){const cells=[];for(let x=s;x<c;x++)cells.push([r,x]);slots.push({t:"A",r,c:s,L,cells});}}}
  for(let c=0;c<5;c++){let r=0;while(r<5){if(grid[r][c]==="#"){r++;continue;}let s=r;while(r<5&&grid[r][c]!=="#")r++;const L=r-s;if(L===2)return null;if(L>=3){const cells=[];for(let y=s;y<r;y++)cells.push([y,c]);slots.push({t:"D",r:s,c,L,cells});}}}
  return slots;
}
function buildPools(band){
  const ts=new Set(BANDS[band].pool),P={},IDX={},FULL={};
  for(const L of ["3","4","5"]){
    P[L]=Object.keys(WORDS[L]).filter(w=>ts.has(WORDS[L][w]));
    const idx={};for(const w of P[L])for(let i=0;i<w.length;i++){const k=i+w[i];(idx[k]||(idx[k]=new Set())).add(w);}
    IDX[L]=idx;FULL[L]=new Set(P[L]);
  }
  return {IDX,FULL};
}
function key(pos,ch){return pos+ch;}
function fillBand(grid,band,seed,nodeBudget=50000){
  const slots=findSlots(grid);if(!slots)return null;
  const {IDX,FULL}=buildPools(band),bias=BANDS[band].bias,rnd=mulberry32(seed>>>0);
  const cell={},used=new Set(),nodes={n:0};
  const cKey=(r,c)=>r+","+c;
  function cset(slot){const Ls=String(slot.L);let cand=null;for(let pos=0;pos<slot.cells.length;pos++){const [r,c]=slot.cells[pos];const v=cell[cKey(r,c)];if(v!==undefined){const s=IDX[Ls][key(pos,v)]||new Set();if(cand===null){cand=new Set(s);}else{cand=new Set([...cand].filter(x=>s.has(x)));}if(cand.size===0)return[];}}return cand===null?[...FULL[Ls]]:[...cand];}
  function solve(rem){
    if(++nodes.n>nodeBudget)return false;
    if(rem.length===0)return true;
    let best=-1,bestN=1e9;
    for(let i=0;i<rem.length;i++){if(rem[i].cells.some(([r,c])=>cell[cKey(r,c)]!==undefined)){const n=cset(rem[i]).length;if(n<bestN){bestN=n;best=i;}if(n===0)break;}}
    if(best<0)best=0;
    const slot=rem[best],rest=rem.slice(0,best).concat(rem.slice(best+1));
    let cs=cset(slot).filter(w=>!used.has(w));
    cs.sort((a,b)=>(-(bias[tierOf(a)]||1)+rnd())-(-(bias[tierOf(b)]||1)+rnd()));
    for(const w of cs){
      const changed=[];let ok=true;
      for(let i=0;i<slot.cells.length;i++){const [r,c]=slot.cells[i],k=cKey(r,c),ch=w[i];if(cell[k]!==undefined){if(cell[k]!==ch){ok=false;break;}}else{cell[k]=ch;changed.push(k);}}
      if(ok){used.add(w);if(solve(rest))return true;used.delete(w);}
      for(const k of changed)delete cell[k];
    }
    return false;
  }
  if(solve(slots.slice())){
    const sol=[];for(let r=0;r<5;r++){const row=[];for(let c=0;c<5;c++)row.push(cell[cKey(r,c)]??"#");sol.push(row);}
    return {sol,slots};
  }
  return null;
}
function entriesOf(sol,slots){return slots.map(s=>({...s,word:s.cells.map(([r,c])=>sol[r][c]).join("")}));}
function connected(sol){
  const W=[];for(let r=0;r<5;r++)for(let c=0;c<5;c++)if(sol[r][c]!=="#")W.push([r,c]);
  if(!W.length)return false;const seen=new Set([W[0].join()]),q=[W[0]];
  while(q.length){const [r,c]=q.pop();for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){const nr=r+dr,nc=c+dc;if(nr>=0&&nr<5&&nc>=0&&nc<5&&sol[nr][nc]!=="#"&&!seen.has(nr+","+nc)){seen.add(nr+","+nc);q.push([nr,nc]);}}}
  return seen.size===W.length;
}
function validate(sol,slots,band){
  const ans=entriesOf(sol,slots).map(e=>e.word),b=BANDS[band],c={};
  c.all_entries_are_words=ans.every(a=>WORDS[String(a.length)][a]!==undefined);
  c.grid_connected=connected(sol);
  c.no_duplicate_answers=new Set(ans).size===ans.length;
  c.one_clue_per_entry=true;
  c.common_vocab_only=c.all_entries_are_words;
  const tiers=ans.map(tierOf),mean=tiers.reduce((x,y)=>x+y,0)/tiers.length,nt3=tiers.filter(t=>t===3).length;
  c.difficulty_in_band=(nt3<=b.maxT3&&mean<=b.maxMean);
  c.rare_words_capped=tiers.filter(t=>t===4).length<=(b.maxT4||0);
  const ent=entriesOf(sol,slots),bySlot=new Map();ent.forEach(e=>e.cells.forEach(([r,cc])=>{const k=r+","+cc;if(!bySlot.has(k))bySlot.set(k,[]);bySlot.get(k).push(e);}));
  c.rare_words_crossed_by_common=ent.every(e=>tierOf(e.word)!==4||e.cells.every(([r,cc])=>bySlot.get(r+","+cc).some(x=>x!==e&&tierOf(x.word)<=2)));
  c.unique_solution=c.no_duplicate_answers&&c.one_clue_per_entry;
  const pass=Object.values(c).every(Boolean);
  return {pass,checks:c,meta:{meanTier:Math.round(mean*100)/100,tier3:nt3,answers:ans}};
}
function produce(band,seed0=0,tries=100){
  const pats=["corners","wings","steps","frame"];
  for(let i=0;i<tries;i++){
    const r=fillBand(PATTERNS[pats[i%4]],band,(seed0*131+i*2654435761)>>>0);
    if(!r)continue;const v=validate(r.sol,r.slots,band);
    if(v.pass)return {sol:r.sol,slots:r.slots,band,seed:(seed0*131+i*2654435761)>>>0,tries:i+1,meta:v.meta};
  }
  return null;
}

/* ---- Digi Puzzles: Mini player (uses engine.js globals + WORDS) ---- */
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

/* An authored, fully-clued sample so the shell opens playable.
   In production the engine fills the grid and Digi Puzzles authors the clues. */
const SAMPLE=window.DN_PUZZLE;

let P=null;         // current puzzle {grid,slots,clues,id,band,nums}
let entries=[];     // player letters 5x5
let checked=null;   // per-cell check state
let sel={r:0,c:0,dir:"A"};
let started=false, tHandle=null, seconds=0, solved=false;

/* ---- numbering + slot lookup ---- */
function numberGrid(grid){
  const nums=Array.from({length:5},()=>Array(5).fill(0));
  let n=0;
  for(let r=0;r<5;r++)for(let c=0;c<5;c++){
    if(grid[r][c]==="#")continue;
    const startA=(c===0||grid[r][c-1]==="#")&&(c<4&&grid[r][c+1]!=="#");
    const startD=(r===0||grid[r-1][c]==="#")&&(r<4&&grid[r+1][c]!=="#");
    if(startA||startD)nums[r][c]=++n;
  }
  return nums;
}
function slotsFrom(grid){return findSlots(grid);}
function wordAt(r,c,dir){
  return P.slots.find(s=>s.t===dir&&s.cells.some(([y,x])=>y===r&&x===c));
}
function clueList(dir){
  return P.slots.filter(s=>s.t===dir).map(s=>{
    const [r,c]=s.cells[0]; const ans=s.cells.map(([y,x])=>P.grid[y][x]).join("").toLowerCase();
    return {num:P.nums[r][c], clue:P.clues[ans]||`(${s.L})`, r, c, dir, ans};
  }).sort((a,b)=>a.num-b.num);
}

/* ---- load a puzzle ---- */
let curSrc=SAMPLE;
function load(pz){
  curSrc=pz;
  P={...pz, slots:slotsFrom(pz.grid), nums:numberGrid(pz.grid)};
  entries=P.grid.map(row=>row.map(ch=>ch==="#"?"#":""));
  checked=P.grid.map(row=>row.map(()=>null));
  solved=false; started=false; seconds=0; stopTimer(); renderTime();
  document.body.classList.remove("win");
  const wm=document.querySelector("#winModal"); if(wm)wm.classList.remove("on");
  const gr=document.querySelector("#grid"); if(gr)gr.classList.remove("celebrate");
  sel={r:0,c:0,dir:"A"};
  const first=P.slots.find(s=>s.t==="A")||P.slots[0]; sel={r:first.cells[0][0],c:first.cells[0][1],dir:first.t};
  $("#pid").textContent=dnLabel(P.id); $("#pband").textContent=P.band;
  buildGrid(); buildClues(); paint(); refreshStreakUI();
  $("#msg").textContent="";
  if(typeof scheduleFit==="function")scheduleFit();
}

/* ---- render grid ---- */
function buildGrid(){
  const g=$("#grid"); g.innerHTML="";
  for(let r=0;r<5;r++)for(let c=0;c<5;c++){
    const cell=document.createElement("div");
    cell.className="cell"+(P.grid[r][c]==="#"?" block":"");
    cell.dataset.r=r; cell.dataset.c=c;
    if(P.grid[r][c]!=="#"){
      if(P.nums[r][c])cell.insertAdjacentHTML("beforeend",`<span class="num">${P.nums[r][c]}</span>`);
      cell.insertAdjacentHTML("beforeend",`<span class="ltr"></span>`);
      cell.addEventListener("click",()=>{
        if(sel.r===r&&sel.c===c)sel.dir=sel.dir==="A"?"D":"A";
        else{sel={r,c,dir:sel.dir};}
        if(!wordAt(r,c,sel.dir))sel.dir=sel.dir==="A"?"D":"A";
        paint();
        if(wantNative())focusHidden();
      });
    }
    g.appendChild(cell);
  }
}
function buildClues(){
  const mk=(dir,host)=>{ host.innerHTML="";
    clueList(dir).forEach(cl=>{
      const el=document.createElement("button"); el.className="clue"; el.type="button";
      el.dataset.dir=dir; el.dataset.r=cl.r; el.dataset.c=cl.c;
      el.innerHTML=`<b>${cl.num}</b><span>${cl.clue}</span>`;
      el.addEventListener("click",()=>{sel={r:cl.r,c:cl.c,dir};paint();});
      host.appendChild(el);
    });
  };
  mk("A",$("#across")); mk("D",$("#down"));
}

/* ---- paint state ---- */
function paint(){
  const active=wordAt(sel.r,sel.c,sel.dir);
  $$("#grid .cell").forEach(cell=>{
    const r=+cell.dataset.r,c=+cell.dataset.c; if(P.grid[r][c]==="#")return;
    cell.classList.remove("active","inword","good","bad");
    const inWord=active&&active.cells.some(([y,x])=>y===r&&x===c);
    if(inWord)cell.classList.add("inword");
    if(r===sel.r&&c===sel.c)cell.classList.add("active");
    if(checked[r][c]==="good")cell.classList.add("good");
    if(checked[r][c]==="bad")cell.classList.add("bad");
    cell.querySelector(".ltr").textContent=entries[r][c]==="#"?"":entries[r][c];
  });
  // clue bar
  if(active){
    const [r,c]=active.cells[0]; const ans=active.cells.map(([y,x])=>P.grid[y][x]).join("").toLowerCase();
    $("#cluebar").innerHTML=`<b>${P.nums[r][c]}${active.t==="A"?"A":"D"}</b> ${P.clues[ans]||"("+active.L+")"}`;
  }
  $$(".clue").forEach(el=>{
    el.classList.toggle("sel", active && +el.dataset.r===active.cells[0][0] && +el.dataset.c===active.cells[0][1] && el.dataset.dir===active.t);
  });
}

/* ---- input ---- */
function advance(back=false){
  const w=wordAt(sel.r,sel.c,sel.dir); if(!w)return;
  const i=w.cells.findIndex(([y,x])=>y===sel.r&&x===sel.c);
  const j=back?i-1:i+1;
  if(j>=0&&j<w.cells.length){sel.r=w.cells[j][0];sel.c=w.cells[j][1];}
}
function type(ch){
  if(P.grid[sel.r][sel.c]==="#"||solved)return;
  startTimer();
  entries[sel.r][sel.c]=ch.toUpperCase(); checked[sel.r][sel.c]=null;
  advance(); paint(); checkWin();
}
function del(){
  if(solved)return; startTimer();
  if(entries[sel.r][sel.c]){entries[sel.r][sel.c]="";checked[sel.r][sel.c]=null;}
  else{advance(true);entries[sel.r][sel.c]="";}
  paint();
}
function move(dr,dc){
  let r=sel.r,c=sel.c;
  for(let k=0;k<5;k++){r+=dr;c+=dc;if(r<0||r>4||c<0||c>4)return;if(P.grid[r][c]!=="#"){sel.r=r;sel.c=c;paint();return;}}
}
document.addEventListener("keydown",e=>{
  if(e.metaKey||e.ctrlKey)return;
  const fromHidden=e.target===hidden;              // native-keyboard input is handled via beforeinput
  if(e.key==="Tab"){gotoClue(e.shiftKey?-1:1);e.preventDefault();return;}
  if(/^[a-zA-Z]$/.test(e.key)){if(!fromHidden){type(e.key);e.preventDefault();}}
  else if(e.key==="Backspace"){if(!fromHidden){del();e.preventDefault();}}
  else if(e.key==="ArrowRight"){sel.dir="A";move(0,1);e.preventDefault();}
  else if(e.key==="ArrowLeft"){sel.dir="A";move(0,-1);e.preventDefault();}
  else if(e.key==="ArrowDown"){sel.dir="D";move(1,0);e.preventDefault();}
  else if(e.key==="ArrowUp"){sel.dir="D";move(-1,0);e.preventDefault();}
  else if(e.key===" "){if(!fromHidden){sel.dir=sel.dir==="A"?"D":"A";paint();e.preventDefault();}}
});

/* ---- check / reveal ---- */
function checkCells(cells){cells.forEach(([r,c])=>{if(P.grid[r][c]==="#")return;checked[r][c]=entries[r][c]===P.grid[r][c]?(entries[r][c]?"good":null):(entries[r][c]?"bad":null);});paint();}
function allCells(){const a=[];for(let r=0;r<5;r++)for(let c=0;c<5;c++)if(P.grid[r][c]!=="#")a.push([r,c]);return a;}
function revealCells(cells){startTimer();cells.forEach(([r,c])=>{if(P.grid[r][c]==="#")return;entries[r][c]=P.grid[r][c];checked[r][c]="good";});paint();checkWin();}
$("#checkWord").onclick=()=>{const w=wordAt(sel.r,sel.c,sel.dir);if(w)checkCells(w.cells);};
$("#checkAll").onclick=()=>checkCells(allCells());
$("#revealWord").onclick=()=>{const w=wordAt(sel.r,sel.c,sel.dir);if(w)revealCells(w.cells);};
$("#revealAll").onclick=()=>revealCells(allCells());

/* ---- timer ---- */
function startTimer(){if(started||solved)return;started=true;tHandle=setInterval(()=>{seconds++;renderTime();},1000);}
function stopTimer(){if(tHandle)clearInterval(tHandle);tHandle=null;}
function renderTime(){const m=String(Math.floor(seconds/60)).padStart(2,"0"),s=String(seconds%60).padStart(2,"0");$("#timer").textContent=`${m}:${s}`;}

/* ---- win + streak ---- */
async function checkWin(){
  if(solved)return;
  const done=allCells().every(([r,c])=>entries[r][c]===P.grid[r][c]);
  if(!done)return;
  solved=true; stopTimer();
  if(P.id===SAMPLE.id)donePut(P.id,{s:seconds});
  $("#msg").innerHTML=`Solved in <b>${$("#timer").textContent}</b>. Nice.`;
  document.body.classList.add("win");
  await bumpStreak();
  celebrate();
}
async function store(get){ // storage abstraction (persistent when available)
  const KEY="digi-mini-streak";
  try{
    if(window.storage){
      if(get){const r=await window.storage.get(KEY);return r?JSON.parse(r.value):null;}
    }
  }catch(e){}
  if(get){try{return JSON.parse(localStorage.getItem(KEY))}catch(e){return null}}
  return null;
}
async function saveStreak(obj){
  const KEY="digi-mini-streak";
  try{if(window.storage){await window.storage.set(KEY,JSON.stringify(obj));return;}}catch(e){}
  try{localStorage.setItem(KEY,JSON.stringify(obj));}catch(e){}
}
function today(){return new Date().toISOString().slice(0,10);}
async function bumpStreak(){
  let s=await store(true)||{last:null,streak:0,best:0,dates:[]};
  const t=today();
  if(s.dates.includes(t)){refreshStreakUI(s);return;}
  const y=new Date(Date.now()-864e5).toISOString().slice(0,10);
  s.streak=(s.last===y)?s.streak+1:1;
  s.last=t; s.best=Math.max(s.best,s.streak); s.dates=[...new Set([...(s.dates||[]),t])].slice(-90);
  await saveStreak(s); refreshStreakUI(s);
}
async function refreshStreakUI(s){
  s=s||await store(true)||{streak:0,best:0};
  $("#streak").textContent=s.streak||0; $("#best").textContent=s.best||0;
}

$("#reset").onclick=()=>load(curSrc);

/* ---- device (native) keyboard via an off-screen input ---- */
const hidden=$("#hidden");
const TOUCH=(window.matchMedia&&window.matchMedia("(pointer:coarse)").matches)||("ontouchstart" in window);
let customKb=false;
function wantNative(){return TOUCH&&!customKb;}
function focusHidden(){if(solved)return;try{hidden.focus({preventScroll:true});}catch(_){hidden.focus();}}
function clearHidden(){hidden.value="";}
function feed(str){for(const ch of str){if(/[a-z]/i.test(ch))type(ch);else if(ch===" "){sel.dir=sel.dir==="A"?"D":"A";paint();}}}
hidden.addEventListener("beforeinput",e=>{
  if(e.inputType==="insertText"||e.inputType==="insertCompositionText"){if(e.data)feed(e.data);e.preventDefault();clearHidden();}
  else if(e.inputType&&e.inputType.indexOf("delete")===0){del();e.preventDefault();clearHidden();}
});
hidden.addEventListener("input",()=>{const v=hidden.value;if(v){feed(v);clearHidden();}}); // fallback where beforeinput is unsupported

/* ---- previous / next clue ---- */
function orderedSlots(){
  const num=s=>P.nums[s.cells[0][0]][s.cells[0][1]];
  const A=P.slots.filter(s=>s.t==="A").sort((a,b)=>num(a)-num(b));
  const D=P.slots.filter(s=>s.t==="D").sort((a,b)=>num(a)-num(b));
  return A.concat(D);
}
function gotoClue(delta){
  const list=orderedSlots(),cur=wordAt(sel.r,sel.c,sel.dir);
  let i=cur?list.indexOf(cur):0; if(i<0)i=0;
  i=(i+delta+list.length)%list.length;
  const s=list[i],cell=s.cells.find(([r,c])=>!entries[r][c])||s.cells[0];
  sel={r:cell[0],c:cell[1],dir:s.t}; paint();
  if(wantNative())focusHidden();
}
$("#prevClue").onclick=()=>gotoClue(-1);
$("#nextClue").onclick=()=>gotoClue(1);
$("#cluebar").addEventListener("click",()=>{
  sel.dir=sel.dir==="A"?"D":"A";
  if(!wordAt(sel.r,sel.c,sel.dir))sel.dir=sel.dir==="A"?"D":"A";
  paint(); if(wantNative())focusHidden();
});
$("#cluebar").addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();$("#cluebar").click();}});

/* ---- show / hide the full clue list ---- */
$("#toggleClues").onclick=()=>{
  const w=$("#cluesWrap"),open=w.hasAttribute("hidden"),t=$("#toggleClues");
  if(open)w.removeAttribute("hidden");else w.setAttribute("hidden","");
  t.setAttribute("aria-expanded",String(open));
  t.textContent=open?"Hide all clues ▴":"Show all clues ▾";
};

/* ---- on-screen keyboard (optional fallback) ---- */
const KB=["QWERTYUIOP","ASDFGHJKL","ZXCVBNM"];
const kbHost=$("#kb");
KB.forEach((row,i)=>{const d=document.createElement("div");d.className="kbrow";
  [...row].forEach(ch=>{const b=document.createElement("button");b.className="key";b.textContent=ch;b.addEventListener("click",()=>type(ch));d.appendChild(b);});
  if(i===2){const b=document.createElement("button");b.className="key wide";b.textContent="⌫";b.addEventListener("click",()=>del());d.appendChild(b);}
  kbHost.appendChild(d);
});
$("#toggleKb").onclick=()=>{
  customKb=!customKb;
  $("#kb").classList.toggle("show",customKb);
  $("#toggleKb").textContent=customKb?"Hide keys":"On-screen keys";
  if(customKb)hidden.blur(); else if(wantNative())focusHidden();
  scheduleFit();
};

/* ---- win celebration ---- */
const reduceMotion=window.matchMedia&&window.matchMedia("(prefers-reduced-motion:reduce)").matches;
function celebrate(){
  for(let r=0;r<5;r++)for(let c=0;c<5;c++)if(P.grid[r][c]!=="#")checked[r][c]="good";
  paint();
  $("#winTime").textContent=$("#timer").textContent;
  $("#winStreak").textContent=$("#streak").textContent;
  $("#winBest").textContent=$("#best").textContent;
  $("#winSub").textContent=`${dnLabel(P.id)} · ${P.band}`;
  if(reduceMotion){$("#winModal").classList.add("on");return;}
  // beat 1 — green cascade sweeps diagonally across the grid (~1.2s)
  const g=$("#grid"); g.classList.add("celebrate");
  $$("#grid .cell").forEach(cell=>{const r=+cell.dataset.r,c=+cell.dataset.c;if(P.grid[r][c]==="#")return;cell.style.animationDelay=((r+c)*90)+"ms";});
  setTimeout(()=>{g.classList.remove("celebrate");$$("#grid .cell").forEach(c=>c.style.animationDelay="");},1900);
  // beat 2 — confetti bursts a beat into the cascade
  setTimeout(()=>confettiBurst(200),350);
  // beat 3 — results card rises after the wave, greeted by a small second burst
  setTimeout(()=>{confettiBurst(80);$("#winModal").classList.add("on");},1450);
}
let _cf={cv:null,ctx:null,parts:[],raf:0,W:0,H:0,dpr:1};
function confettiBurst(n){
  if(reduceMotion)return;
  const cv=$("#confetti"); if(!cv||!cv.getContext)return;
  const ctx=cv.getContext("2d"); if(!ctx)return;
  const dpr=Math.min(2,window.devicePixelRatio||1);
  if(!_cf.raf){                       // (re)size only when idle so a mid-air second burst doesn't reset
    cv.classList.add("on");
    _cf.dpr=dpr; _cf.W=cv.width=innerWidth*dpr; _cf.H=cv.height=innerHeight*dpr;
    cv.style.width=innerWidth+"px"; cv.style.height=innerHeight+"px";
    _cf.cv=cv; _cf.ctx=ctx; _cf.parts.length=0;
  }
  const d=_cf.dpr, cols=["#2E5BFF","#FFD54A","#1F9E6B","#1B3B9E","#ffffff"];
  const rect=$("#grid").getBoundingClientRect();
  const ox=(rect.left+rect.width/2)*d, oy=(rect.top+rect.height*0.42)*d;
  for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2, sp=(4+Math.random()*9)*d;
    _cf.parts.push({x:ox,y:oy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-8*d,g:.16*d,
      w:(5+Math.random()*6)*d,rot:Math.random()*6.28,vr:(-.35+Math.random()*.7),
      col:cols[i%cols.length],life:0,max:110+Math.random()*70});}
  if(!_cf.raf)confettiLoop();
}
function confettiLoop(){
  const {ctx,W,H}=_cf; ctx.clearRect(0,0,W,H); let alive=false;
  for(const p of _cf.parts){ if(p.life>p.max)continue; alive=true;
    p.life++; p.vy+=p.g; p.x+=p.vx; p.y+=p.vy; p.rot+=p.vr;
    ctx.save(); ctx.globalAlpha=Math.max(0,1-p.life/p.max);
    ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.fillStyle=p.col;
    ctx.fillRect(-p.w/2,-p.w/2,p.w,p.w*0.6); ctx.restore(); }
  if(alive){_cf.raf=requestAnimationFrame(confettiLoop);}
  else{_cf.raf=0; _cf.parts.length=0; ctx.clearRect(0,0,W,H); _cf.cv.classList.remove("on");}
}
$("#winShare").onclick=async()=>{
  const txt="✏️ Mini "+dnNum(P.id)+" — "+dnTime($("#timer").textContent)+dnStreak($("#streak").textContent);
  doneCopy(txt,$("#winShare"));
};
$("#winModal").addEventListener("click",e=>{if(e.target===$("#winModal"))$("#winModal").classList.remove("on");});

/* ---- app mode: fit clue + board + keyboard into one screen on touch ---- */
function fitGrid(){
  if(!document.documentElement.classList.contains("app-mode"))return;
  const wrap=document.querySelector(".gridwrap"),g=$("#grid");
  if(!wrap||!g)return;
  const side=Math.max(0,Math.floor(Math.min(wrap.clientWidth,wrap.clientHeight)));
  if(side>0){g.style.setProperty("--side",side+"px");g.style.setProperty("--cell",(side/5)+"px");}
}
let _fitRAF=0;
function scheduleFit(){
  if(!("requestAnimationFrame" in window)){fitGrid();return;}
  cancelAnimationFrame(_fitRAF);
  _fitRAF=requestAnimationFrame(()=>requestAnimationFrame(fitGrid));
}
/* fullscreen — hides browser chrome on Android Chrome; iOS Safari blocks
   element fullscreen, so the button hides itself where it can't work */
(function(){
  const btn=$("#fs"),root=document.documentElement;
  if(!btn)return;
  const req=root.requestFullscreen||root.webkitRequestFullscreen;
  if(!req){btn.style.display="none";return;}
  btn.onclick=()=>{
    const on=document.fullscreenElement||document.webkitFullscreenElement;
    if(on)(document.exitFullscreen||document.webkitExitFullscreen).call(document);
    else req.call(root);
  };
  document.addEventListener("fullscreenchange",scheduleFit);
  document.addEventListener("webkitfullscreenchange",scheduleFit);
})();
const APPMODE=!!(window.matchMedia&&window.matchMedia("(pointer:coarse) and (hover:none)").matches);
function initAppMode(){
  if(!APPMODE)return;               // phones/tablets only — not touchscreen laptops
  document.documentElement.classList.add("app-mode");
  /* 18 Oct 2026: the clue bar lives just above the keyboard on phones (see mini.css) */
  const cbox=document.querySelector(".cluebox"),kbEl=$("#kb");
  if(cbox&&kbEl&&kbEl.parentNode)kbEl.parentNode.insertBefore(cbox,kbEl);
  customKb=true;                       // own keyboard → native one never reflows the layout
  $("#kb").classList.add("show");
  const t=$("#toggleKb"); if(t)t.textContent="Hide keys";
  hidden.blur();
  addEventListener("resize",scheduleFit);
  addEventListener("orientationchange",scheduleFit);
  if(window.visualViewport)visualViewport.addEventListener("resize",scheduleFit);
  scheduleFit();
}
initAppMode();
/* ---- digi-done-v1: a finished puzzle reopens finished (digi-mini-v1 → done[id]) ---- */
const DONE_KEY="digi-mini-v1";
function doneGet(id){try{const s=JSON.parse(localStorage.getItem(DONE_KEY)||"null");return (s&&s.v===1&&s.done&&s.done[id])||null;}catch(e){return null;}}
function donePut(id,rec){try{let s=JSON.parse(localStorage.getItem(DONE_KEY)||"null");if(!s||s.v!==1||!s.done||typeof s.done!=="object")s={v:1,done:{}};if(s.done[id])return;rec.d=new Date().toISOString().slice(0,10);s.done[id]=rec;localStorage.setItem(DONE_KEY,JSON.stringify(s));}catch(e){}doneShow();}
let doneTried=false;
/* ---- digi-done-share-v1: the day's saved result stays shareable after a revisit ---- */
function doneId(){return SAMPLE.id;}
function doneMMSS(s){s=Math.max(0,Math.min(359999,Math.floor(+s)||0));return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0");}
function doneUI(id){const e=document.getElementById(id);return (e&&e.textContent)||"0";}
/* ---- digi-share-v2: one-line emoji share text ---- */
function dnLabel(id){var s=String(id),m=s.match(/·(\d+)$/),n=m?parseInt(m[1],10):NaN;if(isNaN(n)){var h=document.querySelector('meta[name="dn:headline"]'),k=h&&String(h.content).match(/(\d+)\s*$/);n=k?parseInt(k[1],10):NaN;}var t={MINI:"Mini",LEXI:"Doku",SWEEP:"Sweep",PATH:"Path",LINK:"Link",BORD:"Borders",TANG:"Tangle"}[s.split("·")[1]]||"";return isNaN(n)?s:(t?t+" "+n:String(n));}
function dnNum(id){const n=parseInt(String(id).split("·").pop(),10);return isNaN(n)?"":"#"+n;}
function dnTime(t){return String(t||"").trim().replace(/^0+(\d)/,"$1");}
function dnStreak(n){n=parseInt(String(n||"").replace(/\D/g,""),10)||0;return n>=2?" · 🔥"+n:"";}
function doneText(rec){return "✏️ Mini "+dnNum(doneId())+" — "+dnTime(doneMMSS(rec.s))+dnStreak(doneUI("streak"));}
function doneCopy(txt,b){
  const said=t=>{b.textContent=t;setTimeout(()=>{b.textContent="Share result";},1600);};
  const fallback=()=>{try{const ta=document.createElement("textarea");ta.value=txt;ta.setAttribute("readonly","");ta.style.cssText="position:fixed;top:0;left:0;opacity:0";document.body.appendChild(ta);ta.select();const ok=document.execCommand&&document.execCommand("copy");document.body.removeChild(ta);said(ok?"Copied ✓":"Copy unavailable");}catch(e){said("Copy unavailable");}};
  const coarse=!!(window.matchMedia&&window.matchMedia("(pointer:coarse)").matches);
  if(coarse&&navigator.share){try{navigator.share({text:txt}).catch(e=>{if(!e||e.name!=="AbortError")fallback();});return;}catch(e){}}
  try{navigator.clipboard.writeText(txt).then(()=>said("Copied ✓"),fallback);}catch(e){fallback();}
}
function doneShow(){
  const id=doneId(); if(!doneGet(id))return;
  try{document.documentElement.setAttribute("data-dn-done","");}catch(e){}
  if(!document.getElementById("shareAgain")){
    const host=document.querySelector(".controls"); if(!host)return;
    const b=document.createElement("button"); b.type="button"; b.id="shareAgain"; b.className="primary"; b.textContent="Share result";
    b.addEventListener("click",()=>{const r=doneGet(id); if(r)doneCopy(doneText(r),b);});
    host.insertBefore(b,host.firstChild);
  }
  
}
function restoreDone(){
  if(doneTried)return; doneTried=true;
  if(!P||P.id!==SAMPLE.id)return;
  const rec=doneGet(P.id); if(!rec)return;
  for(const [r,c] of allCells()){entries[r][c]=P.grid[r][c];checked[r][c]="good";}
  solved=true; stopTimer(); seconds=Math.max(0,Math.min(359999,Math.floor(+rec.s)||0)); renderTime();
  paint();
  $("#msg").innerHTML=`Solved in <b>${$("#timer").textContent}</b>. Nice.`;
  document.body.classList.add("win");
}
load(SAMPLE);
restoreDone();
doneShow();
