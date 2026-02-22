import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './Home';
import GenerateRecipe from './GenerateRecipe';
import ImportURL from './ImportURL';
import PhotoImport from './PhotoImport';
import IngredientCheck from './IngredientCheck';
import ChatCookingMode from './ChatCookingMode';
import CookingComplete from './CookingComplete';
import CookFreestyle from './CookFreestyle';
import MyRecipes from './MyRecipes';
import AccountSettings from './AccountSettings';
import GroceryList from './GroceryList';
import MealSchedule from './MealSchedule';
import WantToCook from './WantToCook';
import ContinueCooking from './ContinueCooking';
import Onboarding from './Onboarding';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/generate" element={<GenerateRecipe />} />
          <Route path="/import-url" element={<ImportURL />} />
          <Route path="/photo-import" element={<PhotoImport />} />
          <Route path="/ingredient-check" element={<IngredientCheck />} />
          <Route path="/cook" element={<ChatCookingMode />} />
          <Route path="/cook-freestyle" element={<CookFreestyle />} />
          <Route path="/complete" element={<CookingComplete />} />
          <Route path="/my-recipes" element={<MyRecipes />} />
          <Route path="/account-settings" element={<AccountSettings />} />
          <Route path="/grocery-list" element={<GroceryList />} />
          <Route path="/meal-schedule" element={<MealSchedule />} />
          <Route path="/want-to-cook" element={<WantToCook />} />
          <Route path="/continue-cooking" element={<ContinueCooking />} />
          <Route path="/onboarding" element={<Onboarding />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
