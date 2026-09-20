-- The American topic spine, grades 6-12.
create or replace function pg_temp.seed_topics(
  p_curriculum text, p_grade int, p_stream text, p_subject text, p_language text, p_units jsonb
) returns int language plpgsql as $fn$
declare n int;
begin
  insert into public.topics (curriculum_id, grade, stream, subject, unit, name, language, track, sort, family_id)
  select p_curriculum, p_grade, p_stream, p_subject, el->>'unit', t.name, p_language, 'school',
         (e.ord * 100 + t.ord)::int, null
  from jsonb_array_elements(p_units) with ordinality as e(el, ord)
  cross join lateral jsonb_array_elements_text(el->'topics') with ordinality as t(name, ord)
  on conflict do nothing;
  get diagnostics n = row_count; return n;
end $fn$;

select pg_temp.seed_topics('american', 6, null, 'Mathematics', 'en', '[
 {"unit":"Ratios and Proportional Relationships","topics":["Understanding ratios","Unit rates","Equivalent ratios and tables","Percent as a rate per hundred","Converting measurement units"]},
 {"unit":"The Number System","topics":["Dividing fractions by fractions","Multi-digit division","Greatest common factor and least common multiple","Positive and negative numbers","Absolute value","The coordinate plane and four quadrants"]},
 {"unit":"Expressions and Equations","topics":["Writing and evaluating expressions","Exponents","Equivalent expressions and the distributive property","Solving one-step equations","Inequalities on a number line","Dependent and independent variables"]},
 {"unit":"Geometry","topics":["Area of triangles and quadrilaterals","Volume with fractional edge lengths","Polygons on the coordinate plane","Nets and surface area"]},
 {"unit":"Statistics and Probability","topics":["Statistical questions","Dot plots and histograms","Measures of centre","Measures of variability"]}]'::jsonb);
select pg_temp.seed_topics('american', 7, null, 'Mathematics', 'en', '[
 {"unit":"Ratios and Proportions","topics":["Unit rates with fractions","Proportional relationships in tables and graphs","Constant of proportionality","Multi-step percent problems","Scale drawings"]},
 {"unit":"The Number System","topics":["Adding and subtracting rational numbers","Multiplying and dividing rational numbers","Rational numbers as decimals","Solving problems with all four operations"]},
 {"unit":"Expressions and Equations","topics":["Adding and factoring linear expressions","Two-step equations","Two-step inequalities","Word problems with equations"]},
 {"unit":"Geometry","topics":["Angle relationships","Triangle construction and conditions","Circumference of a circle","Area of a circle","Cross-sections of solids","Surface area and volume of prisms"]},
 {"unit":"Statistics and Probability","topics":["Random sampling and inference","Comparing two populations","Simple probability","Compound events and simulation"]}]'::jsonb);
select pg_temp.seed_topics('american', 8, null, 'Mathematics', 'en', '[
 {"unit":"The Number System","topics":["Rational and irrational numbers","Approximating irrational numbers","Square roots and cube roots","Integer exponents","Scientific notation"]},
 {"unit":"Functions","topics":["Defining a function","Linear versus non-linear functions","Rate of change and initial value","Comparing functions in different forms","Describing functional relationships qualitatively"]},
 {"unit":"Expressions and Equations","topics":["Slope and similar triangles","Deriving y = mx + b","Linear equations with one, none or many solutions","Systems of linear equations graphically","Solving systems algebraically"]},
 {"unit":"Geometry","topics":["Transformations: translations, reflections, rotations","Congruence and similarity","Angle-angle criterion","The Pythagorean theorem","Converse of the Pythagorean theorem","Distance on the coordinate plane","Volume of cones, cylinders and spheres"]},
 {"unit":"Statistics","topics":["Scatter plots and association","Lines of best fit","Two-way tables"]}]'::jsonb);
select pg_temp.seed_topics('american', 6, null, 'Science', 'en', '[
 {"unit":"Structure and Properties of Matter","topics":["Atoms and molecules","States of matter and particle motion","Thermal energy and temperature","Physical and chemical changes"]},
 {"unit":"Energy","topics":["Kinetic and potential energy","Energy transfer","Heat transfer: conduction, convection, radiation"]},
 {"unit":"Ecosystems","topics":["Organisms and their environment","Food webs and energy flow","Cycles of matter","Biodiversity and ecosystem health"]},
 {"unit":"Earth and Space","topics":["The solar system","Earth-sun-moon system and seasons","Gravity and orbits","Weather and climate patterns"]}]'::jsonb);
select pg_temp.seed_topics('american', 7, null, 'Science', 'en', '[
 {"unit":"Cells and Living Systems","topics":["Cell structure and function","Cell theory","Body systems and their interactions","Photosynthesis and respiration"]},
 {"unit":"Chemical Reactions","topics":["Evidence of chemical reactions","Conservation of mass","Synthetic materials","Exothermic and endothermic processes"]},
 {"unit":"Forces and Motion","topics":["Speed, velocity and acceleration","Newtons laws of motion","Forces at a distance","Gravitational, electric and magnetic forces"]},
 {"unit":"Earths Systems","topics":["Plate tectonics","Rock cycle and geologic processes","Water cycle and distribution","Natural hazards"]}]'::jsonb);
select pg_temp.seed_topics('american', 8, null, 'Science', 'en', '[
 {"unit":"Waves and Information","topics":["Wave properties: amplitude, wavelength, frequency","Light and the electromagnetic spectrum","Sound waves","Digital signals and information transfer"]},
 {"unit":"Heredity and Evolution","topics":["Genes, chromosomes and DNA","Mendelian inheritance","Mutations and variation","Natural selection","Evidence for common ancestry","Artificial selection"]},
 {"unit":"Energy and Matter in Systems","topics":["Conservation of energy","Energy in chemical processes","Thermal energy transfer in systems"]},
 {"unit":"Human Impact","topics":["Resource use and availability","Climate change evidence","Monitoring and minimising human impact"]}]'::jsonb);
select pg_temp.seed_topics('american', 9, null, 'Algebra I', 'en', '[
 {"unit":"Foundations","topics":["Real numbers and their properties","Order of operations and evaluating expressions","Solving multi-step equations","Literal equations and formulas","Solving and graphing inequalities","Compound inequalities","Absolute value equations and inequalities"]},
 {"unit":"Linear Functions","topics":["Relations, functions and function notation","Slope and rate of change","Slope-intercept and point-slope form","Standard form and intercepts","Parallel and perpendicular lines","Scatter plots and linear regression","Arithmetic sequences"]},
 {"unit":"Systems","topics":["Solving systems by graphing","Substitution","Elimination","Systems of inequalities","Applications of systems"]},
 {"unit":"Exponents and Polynomials","topics":["Laws of exponents","Scientific notation operations","Exponential growth and decay","Adding and subtracting polynomials","Multiplying polynomials","Factoring by GCF and grouping","Factoring trinomials","Difference of squares"]},
 {"unit":"Quadratics","topics":["Graphing quadratic functions","Solving by factoring","Solving by square roots and completing the square","The quadratic formula and the discriminant","Applications of quadratics"]},
 {"unit":"Radicals and Data","topics":["Simplifying radical expressions","Solving radical equations","Measures of centre and spread","Box plots and outliers"]}]'::jsonb);
select pg_temp.seed_topics('american', 10, null, 'Geometry', 'en', '[
 {"unit":"Foundations of Geometry","topics":["Points, lines and planes","Segment and angle measure","Midpoint and distance formulas","Inductive and deductive reasoning","Conditional statements and proof","Parallel lines and transversals"]},
 {"unit":"Triangles","topics":["Triangle sum and exterior angle theorems","Congruent triangles: SSS, SAS, ASA, AAS","Isosceles and equilateral triangles","Triangle inequality","Perpendicular and angle bisectors","Medians, altitudes and points of concurrency"]},
 {"unit":"Similarity and Trigonometry","topics":["Ratios and proportions in geometry","Similar polygons and triangle similarity","Geometric mean","Right triangle trigonometry","Special right triangles","Law of sines and law of cosines"]},
 {"unit":"Quadrilaterals and Polygons","topics":["Properties of parallelograms","Rectangles, rhombuses and squares","Trapezoids and kites","Interior and exterior angles of polygons"]},
 {"unit":"Circles","topics":["Tangents, arcs and chords","Inscribed angles","Segment and angle relationships in circles","Equation of a circle","Arc length and sector area"]},
 {"unit":"Transformations, Area and Volume","topics":["Translations, reflections and rotations","Dilations and scale factor","Symmetry","Area of polygons and composite figures","Surface area of solids","Volume of prisms, pyramids, cones and spheres"]}]'::jsonb);
select pg_temp.seed_topics('american', 11, null, 'Algebra II', 'en', '[
 {"unit":"Functions and Transformations","topics":["Function notation and operations","Composition of functions","Inverse functions","Parent functions and transformations","Piecewise functions"]},
 {"unit":"Polynomial Functions","topics":["Polynomial operations and long division","Synthetic division and the remainder theorem","Factor theorem and rational root theorem","Complex numbers","Fundamental theorem of algebra","Graphing polynomial functions"]},
 {"unit":"Rational and Radical Functions","topics":["Simplifying rational expressions","Operations with rational expressions","Solving rational equations","Graphing rational functions and asymptotes","Rational exponents","Solving radical equations"]},
 {"unit":"Exponential and Logarithmic Functions","topics":["Exponential growth and decay models","The number e","Logarithms and their properties","Solving exponential and logarithmic equations","Applications: compound interest and half-life"]},
 {"unit":"Trigonometry","topics":["The unit circle and radian measure","Graphs of sine and cosine","Amplitude, period and phase shift","Trigonometric identities","Solving trigonometric equations"]},
 {"unit":"Sequences, Series and Statistics","topics":["Arithmetic and geometric sequences","Series and sigma notation","Normal distribution","Sampling and margin of error"]}]'::jsonb);
select pg_temp.seed_topics('american', 12, null, 'Pre-Calculus', 'en', '[
 {"unit":"Functions in Depth","topics":["Analysing graphs and symmetry","Polynomial and rational function behaviour","Exponential and logarithmic models","Inverse trigonometric functions"]},
 {"unit":"Trigonometry","topics":["Trigonometric identities and proofs","Sum and difference formulas","Double and half angle formulas","Law of sines and cosines applications","Polar coordinates","Complex numbers in polar form and De Moivres theorem"]},
 {"unit":"Analytic Geometry","topics":["Conic sections: parabolas","Ellipses","Hyperbolas","Parametric equations","Vectors in two and three dimensions"]},
 {"unit":"Preparing for Calculus","topics":["Sequences and series","Limits and continuity","The difference quotient","Introduction to derivatives"]}]'::jsonb);
select pg_temp.seed_topics('american', 12, null, 'Calculus', 'en', '[
 {"unit":"Limits","topics":["Limits graphically and numerically","Limit laws and algebraic evaluation","One-sided limits and continuity","Infinite limits and asymptotes","The intermediate value theorem"]},
 {"unit":"Derivatives","topics":["Definition of the derivative","Power, product and quotient rules","The chain rule","Implicit differentiation","Derivatives of trigonometric, exponential and logarithmic functions","Related rates"]},
 {"unit":"Applications of Derivatives","topics":["Extrema and the first derivative test","Concavity and the second derivative test","The mean value theorem","Optimisation problems","Curve sketching","Linear approximation"]},
 {"unit":"Integrals","topics":["Antiderivatives and indefinite integrals","Riemann sums","The definite integral","The fundamental theorem of calculus","Integration by substitution","Area between curves","Volumes of revolution"]}]'::jsonb);
select pg_temp.seed_topics('american', 9, null, 'Biology', 'en', '[
 {"unit":"Chemistry of Life","topics":["Water and its properties","Carbohydrates and lipids","Proteins and enzymes","Nucleic acids"]},
 {"unit":"Cells","topics":["Cell theory and microscopy","Prokaryotic and eukaryotic cells","Organelles and their functions","The cell membrane and transport","Osmosis and diffusion"]},
 {"unit":"Energy in Cells","topics":["Photosynthesis: light reactions","Photosynthesis: Calvin cycle","Cellular respiration: glycolysis","Krebs cycle and electron transport","Fermentation"]},
 {"unit":"Genetics","topics":["Mitosis and the cell cycle","Meiosis and gamete formation","Mendelian genetics","Punnett squares and probability","Non-Mendelian inheritance","DNA structure and replication","Transcription and translation","Mutations","Biotechnology and genetic engineering"]},
 {"unit":"Evolution and Ecology","topics":["Evidence for evolution","Natural selection and adaptation","Speciation","Classification and phylogeny","Population ecology","Ecosystems and energy flow","Biogeochemical cycles","Human impact on ecosystems"]}]'::jsonb);
select pg_temp.seed_topics('american', 10, null, 'Chemistry', 'en', '[
 {"unit":"Matter and Measurement","topics":["Scientific method and measurement","Significant figures and dimensional analysis","Physical and chemical properties","Classification of matter"]},
 {"unit":"Atomic Structure","topics":["History of atomic theory","Subatomic particles and isotopes","Electron configuration","Quantum numbers and orbitals","Periodic table organisation","Periodic trends"]},
 {"unit":"Bonding","topics":["Ionic bonding and lattice energy","Covalent bonding and Lewis structures","Molecular geometry and VSEPR","Polarity and intermolecular forces","Metallic bonding","Naming compounds"]},
 {"unit":"Reactions and Stoichiometry","topics":["The mole and molar mass","Percent composition and empirical formulas","Balancing chemical equations","Types of reactions","Stoichiometric calculations","Limiting reactants and percent yield"]},
 {"unit":"States of Matter and Solutions","topics":["Gas laws","The ideal gas law","Kinetic molecular theory","Solutions and solubility","Concentration and molarity","Colligative properties"]},
 {"unit":"Reaction Behaviour","topics":["Thermochemistry and enthalpy","Reaction rates and collision theory","Chemical equilibrium and Le Chateliers principle","Acids, bases and pH","Titration and neutralisation","Oxidation-reduction reactions","Nuclear chemistry"]}]'::jsonb);
select pg_temp.seed_topics('american', 11, null, 'Physics', 'en', '[
 {"unit":"Kinematics","topics":["Scalars, vectors and units","Displacement, velocity and acceleration","Graphical analysis of motion","Equations of motion","Free fall","Projectile motion","Relative motion"]},
 {"unit":"Dynamics","topics":["Newtons first law and inertia","Newtons second law","Newtons third law","Friction","Free-body diagrams","Uniform circular motion","Universal gravitation"]},
 {"unit":"Energy and Momentum","topics":["Work and the work-energy theorem","Kinetic and potential energy","Conservation of energy","Power","Impulse and momentum","Conservation of momentum","Elastic and inelastic collisions"]},
 {"unit":"Waves and Optics","topics":["Simple harmonic motion","Wave properties and behaviour","Sound and the Doppler effect","Reflection and mirrors","Refraction and lenses","Interference and diffraction"]},
 {"unit":"Electricity and Magnetism","topics":["Electric charge and Coulombs law","Electric fields and potential","Capacitance","Current, resistance and Ohms law","Series and parallel circuits","Magnetic fields and forces","Electromagnetic induction"]},
 {"unit":"Modern Physics","topics":["The photoelectric effect","Atomic models and spectra","Nuclear decay and half-life","Fission and fusion"]}]'::jsonb);
select pg_temp.seed_topics('american', 12, null, 'Environmental Science', 'en', '[
 {"unit":"Earth Systems","topics":["Biogeochemical cycles","Plate tectonics and soil formation","Atmosphere and weather","Global water resources"]},
 {"unit":"Living World","topics":["Ecosystem structure and energy flow","Population dynamics and carrying capacity","Biodiversity and conservation","Succession"]},
 {"unit":"Resources and Energy","topics":["Renewable and non-renewable energy","Fossil fuels and their impact","Agriculture and food supply","Water use and management"]},
 {"unit":"Pollution and Global Change","topics":["Air pollution and acid rain","Water pollution","Solid and hazardous waste","Ozone depletion","Climate change: causes and evidence","Sustainability and policy"]}]'::jsonb);
select pg_temp.seed_topics('american', 11, null, 'Statistics', 'en', '[
 {"unit":"Exploring Data","topics":["Types of data and sampling","Displaying distributions","Measures of centre and spread","Normal distributions and z-scores","Scatterplots and correlation","Least-squares regression"]},
 {"unit":"Collecting Data","topics":["Sampling methods and bias","Experimental design","Randomisation, control and blinding"]},
 {"unit":"Probability","topics":["Probability rules","Conditional probability and independence","Random variables","Binomial and geometric distributions","Sampling distributions and the central limit theorem"]},
 {"unit":"Inference","topics":["Confidence intervals for a proportion","Confidence intervals for a mean","Significance tests and p-values","Type I and Type II errors","Chi-square tests","Inference for regression"]}]'::jsonb);
