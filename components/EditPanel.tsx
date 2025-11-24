'use client';

import { PadData } from '@/types';
import { useState } from 'react';

interface EditPanelProps {
  padData: PadData;
  onClose: () => void;
  onSave: (padId: string, updates: Partial<PadData>) => void;
}

export default function EditPanel({ padData, onClose, onSave }: EditPanelProps) {
  const [effect, setEffect] = useState<PadData['effect']>(padData.effect);
  const [reverse, setReverse] = useState(padData.reverse);

  const handleSave = () => {
    onSave(padData.id, { effect, reverse });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl">
        <h2 className="text-2xl font-bold mb-6 text-gray-800">Rediger Pad</h2>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Lyd-effekt
            </label>
            <select
              value={effect}
              onChange={(e) => setEffect(e.target.value as PadData['effect'])}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-purple-500 focus:outline-none text-lg"
            >
              <option value="none">Ingen</option>
              <option value="smurf">Smurfe lyd 🎵</option>
              <option value="troll">Trolllyd 👹</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Spilleretning
            </label>
            <div className="flex gap-4">
              <button
                onClick={() => setReverse(false)}
                className={`
                  flex-1 px-4 py-3 rounded-xl border-2 font-semibold transition-all
                  ${!reverse 
                    ? 'bg-purple-500 text-white border-purple-600' 
                    : 'bg-gray-100 text-gray-700 border-gray-300'
                  }
                `}
              >
                Forover ⏩
              </button>
              <button
                onClick={() => setReverse(true)}
                className={`
                  flex-1 px-4 py-3 rounded-xl border-2 font-semibold transition-all
                  ${reverse 
                    ? 'bg-purple-500 text-white border-purple-600' 
                    : 'bg-gray-100 text-gray-700 border-gray-300'
                  }
                `}
              >
                Baklengs ⏪
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
          >
            Avbryt
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-3 rounded-xl bg-purple-500 text-white font-semibold hover:bg-purple-600 transition-colors"
          >
            Lagre
          </button>
        </div>
      </div>
    </div>
  );
}

