import React, { useState, useEffect } from 'react';

const SCIENCE_FACTS = [
  // Chemistry Facts
  "Water molecules are V-shaped with a 104.5° angle due to oxygen's electron configuration",
  "The only two liquid elements at room temperature are mercury and bromine",
  "A single teaspoon of gold can be beaten into a sheet covering 100 square feet",
  "The electrons in a neon light move at about 2,000 kilometers per second",
  "Diamonds and graphite are both pure carbon, just arranged differently",
  "The human body contains enough carbon to make 900 pencils",
  "Table salt (NaCl) crystals are perfect cubes at the microscopic level",
  "Every atom in your body is billions of years old, created in ancient stars",
  "Helium is the only element discovered in space before Earth",
  "The copper in a penny could be drawn into a wire 30 miles long",
  "Pure gold is so soft that it can be molded with bare hands",
  "A bucket of water contains more atoms than there are buckets of water in the Atlantic Ocean",
  "The average human exhales about 1kg of carbon dioxide per day",
  "Hydrogen is the most abundant element in the universe, making up 75% of all matter by mass",
  "The noble gases were once called 'inert' gases because they rarely react with other elements",
  "Lightning creates ozone, which is why the air smells different after a thunderstorm",
  "The acid in your stomach is strong enough to dissolve zinc",
  "Gallium melts at just above room temperature (85.6°F)",
  "The only letter not appearing in the periodic table is the letter 'J'",
  "A silicon atom is about 0.0000002 millimeters wide",
  "Phosphorus was discovered by an alchemist looking for gold in urine",
  "The first artificial element was technetium, created in 1937",
  "Every breath you take contains at least one molecule from Julius Caesar's last breath",
  "The electrons in a copper atom never touch those of other copper atoms",
  "At room temperature, mercury is the only metal that is liquid",
  "Glass is actually an amorphous solid, not a very slow-flowing liquid",
  "The ozone layer is constantly being destroyed and replenished naturally",
  "Soap molecules have a head that loves water and a tail that hates it",
  "The same iron atoms in your blood can be found in rust",
  "Hydrogen bonds are what make water 'sticky' and give it surface tension",
  "The quantum tunneling effect helps make nuclear fusion possible in stars",
  "Carbon dating works because cosmic rays maintain a steady level of Carbon-14 in the atmosphere",
  "The color of a ruby and a sapphire comes from the same element: chromium",
  "Fluorine is so reactive it can even set fire to water",
  "A crystal of table salt contains equal numbers of sodium and chlorine atoms",
  "The smell of rain comes from bacteria in the soil releasing chemicals called geosmin",
  "Dry ice goes directly from a solid to a gas, skipping the liquid phase",
  "The noble gas xenon can form compounds despite being 'inert'",
  "The electrons in a chemical bond are shared, not transferred",
  "The same carbon atoms in your body could have once been part of a dinosaur",
];

interface LoadingFactsProps {
  isVisible: boolean;
}

export const LoadingFacts: React.FC<LoadingFactsProps> = ({ isVisible }) => {
  // Use a stable initial value (0) and then randomize after mount
  const [currentFactIndex, setCurrentFactIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Add effect to randomize initial fact after mount
  useEffect(() => {
    setCurrentFactIndex(Math.floor(Math.random() * SCIENCE_FACTS.length));
  }, []); // Run once after mount

  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        let nextIndex;
        do {
          nextIndex = Math.floor(Math.random() * SCIENCE_FACTS.length);
        } while (nextIndex === currentFactIndex);
        
        setCurrentFactIndex(nextIndex);
        setIsTransitioning(false);
      }, 800);
    }, 8000);

    return () => clearInterval(interval);
  }, [isVisible, currentFactIndex]);

  return (
    <div className={`absolute inset-0 bg-black bg-opacity-75 z-20 flex flex-col items-center justify-center
      transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mb-8" />
      <div className="max-w-md px-6">
        <div className={`text-center transition-opacity duration-800 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
          <p className="text-lg text-gray-300 font-medium">Did you know?</p>
          <p className="mt-2 text-gray-400">{SCIENCE_FACTS[currentFactIndex]}</p>
        </div>
      </div>
    </div>
  );
}; 