import React from 'react';
import { Card, CardContent } from '../components/ui/card';

const QualityControl = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Quality Control</h1>
      <Card>
        <CardContent className="p-6">
          <p>QC Module - Coming soon with inspection tracking!</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default QualityControl;
