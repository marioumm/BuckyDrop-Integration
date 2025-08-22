/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { CategoriesService } from './categories.service';

@Controller('api/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) { }

  @Get()
  async getCategories() {
    return this.categoriesService.getCategories();
  }

  
  @Get('main')
  async getMainCategories() {
    return this.categoriesService.getMainCategories();
  }

  @Get('product-tags')
  async getProductTags() {
    return this.categoriesService.getProductTags();
  }

  @Get('product-brands')
  async getProductBrands() {
    return this.categoriesService.getProductBrands();
  }

  @Get(':id')
  async getCategoryWithSubcategories(@Param('id', ParseIntPipe) id: number) {
    return await this.categoriesService.getCategoryWithSubcategories(id);
  }


}
