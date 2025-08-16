import { Controller, Get } from '@nestjs/common';
import { CategoriesService } from './categories.service';

@Controller('api')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get('categories')
  async getCategories() {
    return this.categoriesService.getCategories();
  }

  @Get('product-tags')
  async getProductTags() {
    return this.categoriesService.getProductTags();
  }

  @Get('product-brands')
  async getProductBrands() {
    return this.categoriesService.getProductBrands();
  }
}
