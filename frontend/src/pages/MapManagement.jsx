import React from 'react';
import TouristSpots from './MapManagement/TouristSpots';

const MapManagement = ({ activeSubMenu }) => {
  return (
    <div>
      <h2>{activeSubMenu}</h2>

      {activeSubMenu === 'Tourist Spots' && <TouristSpots />}
      {activeSubMenu === 'Routing Settings' && <p>Routing settings UI can be added here later.</p>}
    </div>
  );
};

export default MapManagement;
