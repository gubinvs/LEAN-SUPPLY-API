using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace SUPPLY_API
{
    [ApiController]
    [Route("api/[controller]")]
    public class ReturnBestPriceProviderListArticleController : ControllerBase
    {
        private readonly ILogger<ReturnBestPriceProviderListArticleController> _logger;
        private readonly SupplyComponentContext _db;
        private readonly SupplyPriceComponentContext _dbPrice;
        private readonly SupplyProviderContext _dbProvider;

        public ReturnBestPriceProviderListArticleController(
            ILogger<ReturnBestPriceProviderListArticleController> logger,
            SupplyComponentContext db,
            SupplyPriceComponentContext dbPrice,
            SupplyProviderContext dbProvider)
        {
            _logger = logger;
            _db = db;
            _dbPrice = dbPrice;
            _dbProvider = dbProvider;
        }

        [HttpPost]
        public async Task<IActionResult> ReadComponents([FromBody] ArticleListRequest request)
        {
            try
            {
                // 1. Проверка запроса
                if (request?.Articles == null || !request.Articles.Any() || request.Articles.All(string.IsNullOrWhiteSpace))
                {
                    return BadRequest(new { message = "Список артикулов пуст или содержит некорректные данные" });
                }

                // Очищаем список от мусорных значений (null, пустые строки, пробелы)
                var cleanArticles = request.Articles
                    .Where(a => !string.IsNullOrWhiteSpace(a))
                    .Select(a => a!.Trim()) // После проверки IsNullOrWhiteSpace - a гарантированно не null
                    .ToList();

                if (!cleanArticles.Any())
                    return Ok(new List<object>());

                // 2. Загружаем компоненты. 
                // Проверка !string.IsNullOrWhiteSpace(c.VendorCodeComponent) устраняет nullable-предупреждение
                var components = await _db.SupplyComponent
                    .Where(c => c.VendorCodeComponent != null 
                             && cleanArticles.Contains(c.VendorCodeComponent))
                    .ToListAsync();

                var componentIds = components
                    .Where(c => !string.IsNullOrWhiteSpace(c.GuidIdComponent))
                    .Select(c => c.GuidIdComponent!) // ! - утверждаем, что после проверки не null
                    .ToList();

                if (!componentIds.Any()) 
                    return Ok(new List<object>());

                // 3. Загружаем предложения, отсеивая null и нулевые цены
                var allOffers = await _dbPrice.PriceComponent
                    .Where(p => p.GuidIdComponent != null 
                             && componentIds.Contains(p.GuidIdComponent)
                             && p.PriceComponent != null 
                             && p.PriceComponent > 0)
                    .ToListAsync();

                var providerIds = allOffers
                    .Where(o => !string.IsNullOrWhiteSpace(o.GuidIdProvider))
                    .Select(o => o.GuidIdProvider!)
                    .Distinct()
                    .ToList();

                var providers = await _dbProvider.SupplyProvider
                    .Where(pr => pr.GuidIdProvider != null && providerIds.Contains(pr.GuidIdProvider))
                    .ToListAsync();

                var result = new List<object>();
                foreach (var comp in components)
                {
                    if (string.IsNullOrWhiteSpace(comp.GuidIdComponent)) continue;

                    var compOffers = allOffers
                        .Where(o => o.GuidIdComponent == comp.GuidIdComponent)
                        .ToList();
                    
                    if (!compOffers.Any()) continue;

                    var minPrice = compOffers.Min(o => o.PriceComponent);
                    var bestOffer = compOffers.FirstOrDefault(o => o.PriceComponent == minPrice);
                    
                    if (bestOffer == null) continue;

                    var provider = providers.FirstOrDefault(p => p.GuidIdProvider == bestOffer.GuidIdProvider);

                    result.Add(new
                    {
                        Article = comp.VendorCodeComponent ?? "Не указан",
                        NameComponent = comp.NameComponent ?? "Не указано",
                        Offer = new
                        {
                            NameProvider = string.IsNullOrWhiteSpace(provider?.NameProvider) 
                                ? "Неизвестный поставщик" 
                                : provider.NameProvider,
                            PriceComponent = bestOffer.PriceComponent ?? 0,
                            DeliveryTimeComponent = string.IsNullOrWhiteSpace(bestOffer.DeliveryTimeComponent) 
                                ? "Не указан" 
                                : bestOffer.DeliveryTimeComponent,
                            SaveDataPrice = bestOffer.SaveDataPrice
                        }
                    });
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Ошибка при обработке запроса лучших цен");
                return StatusCode(500, new { message = "Произошла внутренняя ошибка при обработке запроса." });
            }
        }
    }

    public class ArticleListRequest
    {
        public List<string> Articles { get; set; } = new List<string>();
    }
}