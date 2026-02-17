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
        </Routes>
      </div>
    </Router>
  );
}

export default App;
