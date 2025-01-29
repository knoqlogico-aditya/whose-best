import db from "../config/db.js";
import GlobalToggleService from '../services/globalToggleService.js';


export default class BusinessModel {
    static async getUserByEmail(email) {
        try {
            // Query the database to get both userId and user_type
            const [rows] = await db.execute('SELECT user_id, user_type FROM users WHERE email = ?', [email]);

            if (rows.length > 0) {
                return rows[0]; // Return the first row which contains id and user_type
            } else {
                return null; // No user found with the given email
            }
        } catch (error) {
            console.error('Error fetching user by email:', error);
            throw error; // Propagate the error
        }
    }
    static async getRegisteredBusiness(userId) {
        try {
            const [rows] = await db.execute('SELECT * FROM business_detail WHERE user_id = ?', [userId]);
            return rows;
        }
        catch (error) {
            console.error('Error fetching business by user id:', error);
            throw error;
        }
    }
    static async getPaidAdvertisements() {
        const query = `
            SELECT b.*, p.priority
            FROM business_detail b
            JOIN paid_advertisements p ON b.id = p.business_id
            ORDER BY p.priority ASC;
        `;
        try {
            const [results] = await db.execute(query);
            return results;
        } catch (error) {
            console.error('Error fetching paid businesses:', error);
            throw error;
        }
    }
    static async getBusinessCount(toggle){
        try {
            // Define the query
            const query = toggle
  ? `SELECT category, COUNT(*) AS total_listings FROM business_detail WHERE ev_station = true GROUP BY category`
  : `SELECT category, COUNT(*) AS total_listings FROM business_detail GROUP BY category`;

            // Execute the query
            const [results] = await db.execute(query); // Assuming you're using a promise-based DB connection like mysql2
    
            // Convert results into an object with category names as keys
            const counts = results.reduce((acc, row) => {
                acc[row.category] = row.total_listings;
                return acc;
            }, {});
    
            return counts; // Return the object
        } catch (error) {
            throw new Error(`Error fetching category counts: ${error.message}`);
        }
    }
    static async getEmail(email) {
        const [rows] = await db.execute('SELECT email FROM users WHERE email = ?', [email]);
        return rows.length > 0;
    }
    static async getBusinessOwnerByEmail(email) {
        const rows = await db.execute('SELECT user_type FROM users WHERE email = ?', [email]);
        return rows.length > 0 ? rows[0] : null;
    }
    // static async addBusinessEmail (email,businessOwner) {
    //     const [result]= await db.execute('INSERT INTO email_table (email, business_owner) values(?,?)',[email, businessOwner])
    //     return result.insertId;
    // }
    static async setOwner(email) {

        console.log(`asdfa;slkdfj;lkasdflkjasd ${email}`)
        const [result] = await db.execute('UPDATE users SET user_type = "business_owner" WHERE email = ?', [email]);
        
        return result;
    }
    static async insertNameDetails(name, email, phone, userType) {
        const [result] = await db.execute('INSERT INTO users (name,email, phone_number, user_type) VALUES (?,?,?,?)', [name, email, phone, userType]);
        return result;
    }
    static async addBusinessDetails(businessName,  address, category, phone, latitude, longitude, website,  evCharging, userId) {
        console.log('inside addBusinessDetails');
        console.log({ businessName,  address, category, phone, latitude, longitude, website, evCharging, userId });
    
        const [result] = await db.execute(
            'INSERT INTO business_detail (business_name, address, category, phone, latitude, longitude, website, ev_station, user_id) VALUES (?,?,?,?,?,?,?,?,?)',
            [businessName, address, category, phone, latitude, longitude, website,evCharging, userId]
        );
    
        const userId2 = result.insertId;
        return userId2;
    }
    static async addBusinessImages(businessId, images) {
        const values = images.map(image => [businessId, image]);
        await db.query(`INSERT INTO business_images (business_id, image_path) VALUES ?`, [values]);
    }
    static async updateName(userId, name, phoneNumber, profileImage){
        try {
            console.log(`Updating user ${userId} with name=${name}, phone=${phoneNumber}`);
    
            let sql, values;

            if (profileImage) {
                sql = "UPDATE users SET name = ?, phone_number = ?, profile_image = ? WHERE user_id = ?";
                values = [name, phoneNumber, profileImage, userId];
            } else {
                sql = "UPDATE users SET name = ?, phone_number = ? WHERE user_id = ?";
                values = [name, phoneNumber, userId];
            }
    
            const [result] = await db.execute(sql, values);
            return result;
        } catch (error) {
            console.error("Database Error:", error);
            throw error;
        }

    }
    // static async addBusinessDetails(businessName, pincode, city, state, category, phone, latitude, longitude, website, imag) {
    //     try {
    //         // Insert business details into the database
    //         const [result] = await db.execute(
    //             `INSERT INTO businesses (business_name, pincode, city, state, category, phone, latitude, longitude, website, images)
    //              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    //             [businessName, pincode, city, state, category, phone, latitude, longitude, website, JSON.stringify(images)]
    //         );
    
    //         return result.insertId; // Return the new business ID
    //     } catch (error) {
    //         console.error('Database error:', error);
    //         throw error;
    //     }
    // }
    static async getAllBusinessDetails() {
        const [rows] = await db.execute('SELECT * FROM business_details');
        return rows;
    }
    

    static async getBusinessesByCategoryAndSort(category, sortBy, limit, offset, toggle) {
        
        const validSortOptions = {
            rating: 'rating DESC',
            totalRatings: 'total_ratings DESC',
        };
        const orderBy = validSortOptions[sortBy] || validSortOptions.rating;
        
        const query = toggle ? `SELECT SQL_CALC_FOUND_ROWS *
            FROM business_detail
            WHERE category = ? AND ev_station = true
            ORDER BY ${orderBy}
            LIMIT ? OFFSET ?`: `SELECT SQL_CALC_FOUND_ROWS *
            FROM business_detail
            WHERE category = ? 
            ORDER BY ${orderBy}
            LIMIT ? OFFSET ? `;
        try {
            const [results] = await db.execute(query, [category, limit, offset]);
            const [[{ total }]] = await db.query('SELECT FOUND_ROWS() AS total');
            return { businesses: results, total };
        } catch (error) {
            console.error('Error fetching businesses by category and sorting:', error);
            throw error;
        }
    }
    
    static async getSuggestions(query) {
        const sql = `
        SELECT DISTINCT name FROM businesses WHERE name LIKE ?
        UNION
        SELECT DISTINCT category FROM businesses WHERE category LIKE ?
    `;
        const params = [`%${query}%`, `%${query}%`];
        const [results] = await db.query(sql, params);
        return results.map(row => Object.values(row)[0]);

    }

    static async saveRating(userId, businessId, rating, review) {
        try {
            // Insert the rating into the database
            const [result] = await db.execute(
                'INSERT INTO reviews (user_id, business_id, rating, review) VALUES (?, ?, ?, ?)',
                [userId, businessId, rating, review]
            );
    
            // Return a success response with the inserted record's ID
            return {
                success: true,
                message: 'Rating saved successfully',
                insertedId: result.insertId, // The ID of the newly inserted record
            };
        } catch (error) {
            // Log the error for debugging
            console.error('Error saving rating:', error);
    
            // Return a failure response with the error details
            return {
                success: false,
                message: 'Failed to save rating',
                error: error.message, // Include error message for debugging
            };
        }
    }
    static async createTestimonial(userId, name, location, stars, comment ){
        const query = `INSERT INTO testimonials (user_id, name, location, stars, comment) VALUES (?, ?, ?, ?, ?)`;
        const values = [user_id, name, location, stars, comment];
    
        try {
            const [result] = await db.query(query, values);
            return result;
        } catch (error) {
            throw error;
        }

    }
    static async getBusinessDetailsById(id) {
        try {
            const [businessRows] = await db.execute('SELECT * FROM business_detail  WHERE id = ? ', [id]);
            const [reviewRows] = await db.execute('SELECT * FROM reviews WHERE business_id = ?', [id]);
         
            if(businessRows.length>0){
                const businessDetails = businessRows[0];
                businessDetails.reviews = reviewRows;

                console.log(businessDetails)
                return businessDetails;

            }
            else{
                return null;
            }
        } catch (error) {
            console.error('Error fetching businesses by category:', error);
            throw error; // Propagate the error
        }
    }
    static async deleteReviewById(reviewId) {
        const sql = "DELETE FROM reviews WHERE review_id = ?";
        const [result] = await db.execute(sql, [reviewId]);
        return result; // Returns affectedRows to check if deletion was successful
    }
    static async hasUserReviewed(businessId, userId) {
        console.log(`businessid is ${businessId} and userID is ${userId}`)
        const [rows] = await db.execute('SELECT * FROM reviews WHERE business_id = ? AND user_id = ?', [businessId, userId]);
        console.log(`the hasuserreviewed status is ${rows}`);
        return rows.length > 0;
    }
    
     // edit
    // static async getBusinessDyetailsById(id) {
    //     try {
    //         const [rows] = await db.query('SELECT * FROM businesses WHERE id = ?', [id]);
    //         return rows.length > 0 ? rows[0] : null;
    //     } catch (error) {
    //         throw error;
    //     }
    // }
     
    static async getUserByUserId(userId) {
        try {
        
            const [rows] = await db.query('SELECT * FROM users WHERE user_id = ?', [userId]);
            console.log(rows[0]);
            return rows? rows[0] : null;
        } catch (error) {
            console.error('Error fetching users by user_id:', error);
            throw error;
        }
    }
    
    
    // async  getAllUsersOrderedByName() {
    //     try {
    //         const [rows] = await db.query('SELECT * FROM users ORDER BY name' );
    //         return rows;
    //     } catch (error) {
    //         console.error('Error fetching users:', error);
    //         throw error;
    //     }
    // }
    
    // user update information name,phone_number
    static async updateInformation(name, phone_number, callback) {
        try {
            const [results] = await db.query(
                'UPDATE users SET name = ? WHERE phone_number = ?',
                [name, phone_number]
            );
            callback(null, results);
        } catch (err) {
            callback(err, null);
        }
    }
    


}

// (async () => {
//     const id = 1; // Replace with the desired ID
//     const businessDetails = await BusinessModel.getBusinessDetailsById(id);

//     if (businessDetails && businessDetails.message !== "No business found with the provided ID") {
//         console.log("Business Details from IIFE: ", businessDetails);
//     } else {
//         console.log("No business found with the given ID.");
//     }
// })();