// ── Category colours ─────────────────────────────────────────────────────────
export const CAT_COLORS = {
  'Indoor Physical Activity': '#3B82F6',
  'Outdoor Physical Activity': '#22C55E',
  Diet: '#84CC16',
  Sleep: '#A78BFA',
  'Recovery Protocol': '#06B6D4',
  Breathwork: '#EC4899',
  Circadian: '#F97316',
  Supplement: '#F59E0B',
  Biohacking: '#00D4AA',
  Peptide: '#8B5CF6',
  Medication: '#F43F5E',
  Exercise: '#3B82F6',
  Other: '#94A3B8',
};

// ── Action presets per category ───────────────────────────────────────────────
export const ACTION_PRESETS = {
  'Indoor Physical Activity': [
    'Strength Training','HIIT','Yoga / Mobility','Pilates','Treadmill Run',
    'Rowing Machine','Stationary Cycling','Jump Rope','Bodyweight Circuit',
    'Stretching / Flexibility','Barre','CrossFit','Indoor Climbing','Swimming (Pool)',
    'Zone 2 Cardio (Indoor)','Rest Day',
  ],
  'Outdoor Physical Activity': [
    'Running','Cycling','Walking','Hiking','Swimming (Open Water)',
    'Zone 2 Cardio (Outdoor)','Trail Run','Park Workout','Team Sport',
    'Surfing','Tennis','Golf','Kayaking / Rowing','Sprint Intervals','Morning Walk',
  ],
  Diet: [
    'Intermittent Fasting','Ketogenic','High Carb','Low Carb','Protein Focus',
    'Anti-inflammatory','Caloric Deficit','Balanced Macros','High Fat / Low Carb',
    'Time-Restricted Eating (16:8)','OMAD','Carb Cycling','Plant-Based Day',
  ],
  Sleep: [
    'Early Bedtime','Sleep Optimisation','Nap','Blue Light Blocking',
    'Magnesium Protocol','No Caffeine After 2pm','Sleep Restriction Protocol',
    'Consistent Wake Time','Dark & Cool Room',
  ],
  'Recovery Protocol': [
    'Active Recovery','Foam Rolling','Massage','Stretching','Deload Week',
    'HRV Rest Day','Contrast Therapy','Compression Garments','Epsom Salt Bath',
  ],
  Breathwork: [
    'Box Breathing','Wim Hof','4-7-8 Breathing','HRV Coherence Training',
    'Nasal Only Breathing','Cyclic Sighing','Physiological Sigh',
  ],
  Circadian: [
    'Morning Sunlight','Fixed Wake Time','No Screens After 9pm',
    'Time-Restricted Eating','Dark Environment','Evening Walk','Grounding',
  ],
  Supplement: [
    'Magnesium Glycinate','Omega-3','Vitamin D3/K2','NAD+/NMN','Ashwagandha',
    'Creatine','L-Theanine','Zinc','Rhodiola','CoQ10','Alpha-Lipoic Acid',
    'Berberine','Quercetin','Custom Supplement',
  ],
  Biohacking: [
    'Sauna','Cold Plunge','Red Light Therapy','Cold Water Immersion',
    'Float Tank','PEMF','Hyperbaric Oxygen','Ozone Therapy',
    'Infrared Blanket','Neurofeedback','HRV Biofeedback',
  ],
  Peptide: [
    'BPC-157','TB-500','GHK-Cu','Semaglutide','Tirzepatide',
    'Ipamorelin / CJC-1295','PT-141','Epithalon','Custom Peptide Protocol',
  ],
  Medication: [
    'Testosterone Gel','Testosterone Injection','Metformin','Thyroid Medication',
    'HCG','Anastrozole','Clomid','DHEA','Pregnenolone','Custom Medication',
  ],
  Other: ['Custom'],
};

export const CATEGORY_GROUPS = [
  { label: 'Physical', cats: ['Indoor Physical Activity','Outdoor Physical Activity'] },
  { label: 'Nutrition', cats: ['Diet'] },
  { label: 'Recovery & Wellness', cats: ['Sleep','Recovery Protocol','Breathwork','Circadian'] },
  { label: 'Intervention', cats: ['Supplement','Biohacking','Peptide','Medication'] },
  { label: 'Other', cats: ['Other'] },
];

// ── ActionCategory CSV name → internal name ───────────────────────────────────
export const ACTCAT_MAP = {
  macronutrition:'Diet', macrocombo:'Diet', macro:'Diet', macronutrient:'Diet',
  macronutrients:'Diet', diet:'Diet', nutrition:'Diet', food:'Diet', meal:'Diet',
  indoorphysicalactivities:'Indoor Physical Activity',
  indoorphysicalactivity:'Indoor Physical Activity',
  indooractivity:'Indoor Physical Activity', indoorexercise:'Indoor Physical Activity',
  exercise:'Indoor Physical Activity', workout:'Indoor Physical Activity', training:'Indoor Physical Activity',
  outdoorphysicalactivities:'Outdoor Physical Activity',
  outdoorphysicalactivity:'Outdoor Physical Activity',
  outdooractivity:'Outdoor Physical Activity', outdoorexercise:'Outdoor Physical Activity',
  outdoor:'Outdoor Physical Activity',
  supplement:'Supplement', supplements:'Supplement', supps:'Supplement',
  biohacking:'Biohacking', biohack:'Biohacking',
  sleep:'Sleep', sleepprotocol:'Sleep',
  recoveryprotocol:'Recovery Protocol', recovery:'Recovery Protocol',
  breathwork:'Breathwork', breathing:'Breathwork',
  circadian:'Circadian', peptide:'Peptide', peptides:'Peptide',
  medication:'Medication', medicine:'Medication', drug:'Medication',
};

export const STORE_KEY = 'sos_v4_rows';
export const ACT_KEY   = 'sos_v4_actions';
