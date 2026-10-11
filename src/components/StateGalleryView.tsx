import React, { useState } from 'react';
import CustomSelect from './ui/CustomSelect';

export const StateGalleryView: React.FC = () => {
  const [selectedVal, setSelectedVal] = useState('Option 1');

  return (
    <div className="p-6 space-y-6 bg-[#1A1A1A] text-white">
      <h2 className="text-xl font-bold font-cinzel text-[#FBF3DF]">Component & State Gallery</h2>
      <p className="text-xs text-[#B3AABD]">Audit gallery verifying contrast tokens and interactive states.</p>

      <div className="w-64">
        <CustomSelect
          label="Category"
          value={selectedVal}
          options={['Option 1', 'Option 2', 'Option 3']}
          onChange={(val) => setSelectedVal(val)}
        />
      </div>
    </div>
  );
};

export default StateGalleryView;
