using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace SUPPLY_API 
{
    [ApiController]
    [Route("v1/[controller]")]
    // Исправили Contriller -> Controller
    public class AddRecordProviderManufacturerController : ControllerBase 
    {
        private readonly ILogger<AddRecordProviderManufacturerController> _logger;
        private readonly SupplyContext _db;

        public AddRecordProviderManufacturerController(
            ILogger<AddRecordProviderManufacturerController> logger,
            SupplyContext db) 
        {
            _logger = logger;
            _db = db;
        }

        [HttpPost]
        public async Task<IActionResult> AddRecordProviderManufacturer([FromBody] ProviderManufacturerModel model) 
        {
            // 1. Используем await и AnyAsync (он быстрее, так как не тянет всю запись из БД)
            bool isExists = await _db.ProviderManufacturer
                .AnyAsync(x => x.GuidIdManufacturer == model.GuidIdManufacturer 
                            && x.GuidIdProvider == model.GuidIdProvider);
            
            if (isExists) 
            {
                // Возвращаем 409 Conflict (или оставьте Ok, если фронтенд настроен именно на 200)
                return Conflict(new { message = "Такая связка уже есть в базе" });
            }
        
            var newRecord = new ProviderManufacturerDb()
            {
                GuidIdManufacturer = model.GuidIdManufacturer,
                GuidIdProvider = model.GuidIdProvider  
            };

            // 2. Используем асинхронные методы EF Core
            await _db.ProviderManufacturer.AddAsync(newRecord);
            await _db.SaveChangesAsync();

            return Ok(new { message = "Все данные переданы успешно!" });
        }

    }
}
