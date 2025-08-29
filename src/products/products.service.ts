import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { WooCommerceHttpService } from '../shared/woocommerce-http.service';
import { ProductQueryDto } from './dto/prodcut-query.dto';
import axios, { AxiosResponse } from 'axios';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  private existFlag = false;
  constructor(private readonly httpService: WooCommerceHttpService) {}

  /**
   * Helper to check if a product exists in wishlist/cart, with 500 fallback.
   */
  private async checkIfExistsIn(
    type: 'wishlist' | 'cart',
    productId: string,
    headers: Record<string, string>,
  ): Promise<boolean> {
    const url = `https://api-gateway.camion-app.com/${type}/check-product`;
    try {
      const response: AxiosResponse<{ exists: boolean }> = await axios.post(
        url,
        { productId },
        { headers },
      );
      if (!response.data.exists) {
        this.existFlag = true;
      }
      return response.data.exists || false;
    } catch (err: any) {
      if (err?.response?.status === 500) {
        this.logger.warn(
          `${type} service returned 500 — assuming not in ${type}`,
        );
      }

      // console.error(err); // Debugging
      return false;
    }
  }
  
  private safeParse = (val: any) =>
    isNaN(parseFloat(val)) ? 0 : parseFloat(val);
  private transformProductPrices(product: any, multiplier = 5) {
    if (!product?.prices) return product;


    const price = this.safeParse(product.prices.price) * multiplier;
    const regularPrice = this.safeParse(product.prices.regular_price) * multiplier;
    const salePrice = this.safeParse(product.prices.sale_price) * multiplier;

    return {
      ...product,
      prices: {
        ...product.prices,
        price: (price / 100).toFixed(2),
        regular_price: (regularPrice / 100).toFixed(2),
        sale_price: (salePrice / 100).toFixed(2),
      },
    };
  }

  async getProduct(id: string, token: string) {
    try {
      let response = await this.httpService.get(`/products/${id}`);
      const { data: variations } = await this.httpService.get(
        `/products/${id}/variations`,
        undefined,
        true,
        'V3',
      );

      if (variations && Array.isArray(variations)) {
        response.data['variations'] = variations.map((v) => ({
          id: v.id,
          attributes:
            v.attributes?.map((attr) => ({
              name: attr.name,
              option: attr.option,
            })) || [],
          image: v.image?.src || null,
          price: this.safeParse(v.price) * 5 || null,
          regular_price: this.safeParse(v.regular_price) * 5 || null,
          sale_price: this.safeParse(v.sale_price) * 5 || null,
          stock_quantity: v.stock_quantity ?? null,
          stock_status: v.stock_status || null,
        }));
      }

      const productData = this.transformProductPrices(response.data);

      this.logger.log(`Product #${id} details fetched successfully`);

      const authHeaders = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const [wishlist, cart] = await Promise.all([
        this.checkIfExistsIn('wishlist', id, authHeaders),
        this.checkIfExistsIn('cart', id, authHeaders),
      ]);

      return {
        ...productData,
        wishlist,
        cart,
        ...(this.existFlag
          ? {}
          : {
              message: 'Check Local Server, Item might be in wishlist or cart',
            }),
      };
    } catch (error) {
      this.logger.error(`Error fetching product #${id}: ${error?.message}`);
      if (error.response?.status === 404) {
        throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        {
          error: 'Failed to fetch product',
          details: error.response?.data || error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getProduct_Sync(id: string) {
    try {
            let response = await this.httpService.get(`/products/${id}`);
      const { data: variations } = await this.httpService.get(
        `/products/${id}/variations`,
        undefined,
        true,
        'V3',
      );

      if (variations && Array.isArray(variations)) {
        response.data['variations'] = variations.map((v) => ({
          id: v.id,
          attributes:
            v.attributes?.map((attr) => ({
              name: attr.name,
              option: attr.option,
            })) || [],
          image: v.image?.src || null,
          price: this.safeParse(v.price) * 5 || null,
          regular_price: this.safeParse(v.regular_price) * 5 || null,
          sale_price: this.safeParse(v.sale_price) * 5 || null,
          stock_quantity: v.stock_quantity ?? null,
          stock_status: v.stock_status || null,
        }));
      }

      const productData = this.transformProductPrices(response.data);
      this.logger.log(`Product #${id} details fetched successfully`);
      return productData;
    } catch (error) {
      this.logger.error(`Error fetching product #${id}: ${error?.message}`);
      if (error.response?.status === 404) {
        throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
      }
      throw new HttpException(
        {
          error: 'Failed to fetch product',
          details: error.response?.data || error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getProducts(query: ProductQueryDto) {
  try {
    const params = new URLSearchParams();
    const { min_price, max_price, ...filteredQuery } = query;

    Object.entries(filteredQuery).forEach(([key, value]) => {
      if (value) params.append(key, String(value));
    });

    const fetchProducts = async (perPage: number, page: number) => {
      const response = await this.httpService.get(
        `/products?${params.toString()}&per_page=${perPage}&page=${page}`,
      );
      return response;
    };

    const perPage = parseInt(query.per_page ?? '10');
    const currentPage = parseInt(query.page ?? '1');

    let response = await fetchProducts(perPage, currentPage);
    let originalProducts = response.data;

    // filter out by price & min/max
    let filteredProducts = originalProducts.filter((product: any) => {
      const rawPrice = parseFloat(product.prices?.price ?? '0');
      const hasImages = Array.isArray(product.images) && product.images.length > 0;
      if (rawPrice <= 0 || !hasImages) return false;

      const withinMin = min_price ? rawPrice >= parseFloat(min_price) : true;
      const withinMax = max_price ? rawPrice <= parseFloat(max_price) : true;
      return withinMin && withinMax;
    });

    // if not enough products → request more
    let badCount = perPage - filteredProducts.length;
    let nextPage = currentPage + 1;

    while (badCount > 0 && nextPage <= parseInt(response.headers['x-wp-totalpages'] ?? '1')) {
      const extraResponse = await fetchProducts(badCount, nextPage);
      const extraProducts = extraResponse.data.filter((product: any) => {
        const rawPrice = parseFloat(product.prices?.price ?? '0');
        const hasImages = Array.isArray(product.images) && product.images.length > 0;
        if (rawPrice <= 0 || !hasImages) return false;

        const withinMin = min_price ? rawPrice >= parseFloat(min_price) : true;
        const withinMax = max_price ? rawPrice <= parseFloat(max_price) : true;
        return withinMin && withinMax;
      });

      filteredProducts = [...filteredProducts, ...extraProducts];
      badCount = perPage - filteredProducts.length;
      nextPage++;
    }

    // final transform
    const modifiedProducts = filteredProducts
      .slice(0, perPage) // in case we got extra
      .map((product) => this.transformProductPrices(product));

    return {
      products: modifiedProducts,
      pagination: {
        total: parseInt(response.headers['x-wp-total']) || 0,
        totalPages: parseInt(response.headers['x-wp-totalpages']) || 1,
        currentPage,
        perPage,
      },
    };
  } catch (error) {
    this.logger.error(`Error fetching products: ${error?.message}`);
    throw new HttpException(
      {
        error: 'Failed to fetch products',
        details: error.response?.data || error.message,
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}


  async getProductAttributes(id: string) {
    try {
      const response = await this.httpService.get(`/products/attributes/${id}`);
      return response.data;
    } catch (error) {
      this.logger.error('Error fetching product attributes:', error.message);
      throw new HttpException(
        'Failed to fetch product attributes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getProductsAttributes() {
    try {
      const response = await this.httpService.get('/products/attributes');
      return response.data;
    } catch (error) {
      this.logger.error('Error fetching product attributes:', error.message);
      throw new HttpException(
        'Failed to fetch product attributes',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getProductReviews(productId?: string) {
    try {
      const endpoint = productId
        ? `/products/reviews?product_id=${productId}}`
        : '/products/reviews';
      const response = await this.httpService.get(endpoint);
      
      return response.data;
    } catch (error) {
      this.logger.error('Error fetching product reviews:', error.message);
      throw new HttpException(
        'Failed to fetch product reviews',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Create a new product review
   */
  async createProductReview(reviewData: {
    product_id: number;
    review: string;
    reviewer: string;
    reviewer_email: string;
    rating: number;
    status?: string;
  }) {
    try {
      const response = await this.httpService.post(
        '/products/reviews',
        reviewData,
        undefined,
        true,
        'V3',
      );
      return response.data;
    } catch (error) {
      this.logger.error('Error creating product review:', error.message);
      throw new HttpException(
        {
          error: 'Failed to create product review',
          details: error.response?.data || error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get a single product review by ID
   */
  async getProductReview(reviewId: string) {
    try {
      const response = await this.httpService.get(
        `/products/reviews/${reviewId}`,
        undefined,
        true,
        'V3',
      );
      return response.data;
    } catch (error) {
      this.logger.error('Error fetching product review:', error.message);
      if (error.response?.status === 404) {
        throw new HttpException(
          'Product review not found',
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        {
          error: 'Failed to fetch product review',
          details: error.response?.data || error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Update a product review
   */
  async updateProductReview(
    reviewId: string,
    updateData: {
      review?: string;
      reviewer?: string;
      reviewer_email?: string;
      rating?: number;
      status?: string;
    },
  ) {
    try {
      const response = await this.httpService.put(
        `/products/reviews/${reviewId}`,
        updateData,
        undefined,
        true,
        'V3',
      );
      return response.data;
    } catch (error) {
      this.logger.error('Error updating product review:', error.message);
      if (error.response?.status === 404) {
        throw new HttpException(
          'Product review not found',
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        {
          error: 'Failed to update product review',
          details: error.response?.data || error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Delete a product review
   */
  async deleteProductReview(reviewId: string, force: boolean = true) {
    try {
      const url = force
        ? `/products/reviews/${reviewId}?force=true`
        : `/products/reviews/${reviewId}`;
      const response = await this.httpService.delete(
        url,
        undefined,
        true,
        'V3',
      );
      return response.data;
    } catch (error) {
      this.logger.error('Error deleting product review:', error.message);
      if (error.response?.status === 404) {
        throw new HttpException(
          'Product review not found',
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        {
          error: 'Failed to delete product review',
          details: error.response?.data || error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Batch update product reviews (create, update, delete multiple reviews)
   */
  async batchUpdateProductReviews(batchData: {
    create?: Array<{
      product_id: number;
      review: string;
      reviewer: string;
      reviewer_email: string;
      rating: number;
    }>;
    update?: Array<{
      id: number;
      review?: string;
      reviewer?: string;
      reviewer_email?: string;
      rating?: number;
      status?: string;
    }>;
    delete?: number[];
  }) {
    try {
      const response = await this.httpService.post(
        '/products/reviews/batch',
        batchData,
      );
      return response.data;
    } catch (error) {
      this.logger.error('Error batch updating product reviews:', error.message);
      throw new HttpException(
        {
          error: 'Failed to batch update product reviews',
          details: error.response?.data || error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
